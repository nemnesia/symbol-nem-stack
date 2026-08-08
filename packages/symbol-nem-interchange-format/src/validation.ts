import { error, failure, success } from './errors.js';
import type {
  JsonObject,
  JsonValue,
  ProtectedPayload,
  SnifData,
  SnifError,
  SnifResult,
  StandardSnifType,
} from './types.js';
import { STANDARD_TYPES } from './types.js';

type RecordValue = Record<string, JsonValue>;

// 成功値を破棄して、検証結果だけを次の検証段階へ渡すための内部helper。
function discard<T>(result: SnifResult<T>): SnifResult<void> {
  return result.ok ? success(undefined) : result;
}

const has = (object: RecordValue, key: string): boolean => Object.prototype.hasOwnProperty.call(object, key);

export function isPlainObject(value: unknown): value is JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * JavaScript値がSNIFのJSON値モデルに収まるか再帰的に検査します。
 * ancestorsは循環参照の検出専用で、兄弟要素間の同一参照は拒否しません。
 */
function inspectJsonValue(value: unknown, ancestors: WeakSet<object>): SnifError | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return undefined;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? undefined : error('NON_FINITE_NUMBER');
  }
  if (typeof value !== 'object') return error('INVALID_JSON_VALUE');

  if (ancestors.has(value)) return error('CIRCULAR_REFERENCE');
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      // JSON.stringifyは要素以外のtoJSONや追加プロパティも参照するため、
      // 配列のlengthと正規の要素以外のown propertyをJSON値として拒否する。
      if (Object.getOwnPropertySymbols(value).length > 0) return error('INVALID_JSON_VALUE');
      for (const key of Object.getOwnPropertyNames(value)) {
        if (key === 'length') continue;
        const index = Number(key);
        const isArrayIndex = Number.isInteger(index) && index >= 0 && index < 2 ** 32 - 1 && String(index) === key;
        if (!isArrayIndex) return error('INVALID_JSON_VALUE');
      }
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          return error('INVALID_JSON_VALUE');
        }
        const nestedError = inspectJsonValue(value[index], ancestors);
        if (nestedError) return nestedError;
      }
      return undefined;
    }

    if (!isPlainObject(value)) return error('INVALID_JSON_VALUE');
    if (Object.getOwnPropertySymbols(value).length > 0) return error('INVALID_JSON_VALUE');
    for (const key of Object.keys(value)) {
      const nestedError = inspectJsonValue(value[key], ancestors);
      if (nestedError) return nestedError;
    }
    return undefined;
  } finally {
    ancestors.delete(value);
  }
}

export function validateJsonValue(value: unknown): SnifResult<void> {
  const validationError = inspectJsonValue(value, new WeakSet<object>());
  return validationError ? { ok: false, error: validationError } : success(undefined);
}

function requireString(object: RecordValue, key: string, path: string): SnifResult<string> {
  if (!has(object, key)) return failure('MISSING_REQUIRED_FIELD', path);
  return typeof object[key] === 'string' ? success(object[key] as string) : failure('INVALID_FIELD_TYPE', path);
}

function optionalString(object: RecordValue, key: string, path: string): SnifResult<void> {
  if (!has(object, key)) return success(undefined);
  return typeof object[key] === 'string' ? success(undefined) : failure('INVALID_FIELD_TYPE', path);
}

function validateHex(object: RecordValue, key: string, path: string, required: boolean): SnifResult<void> {
  if (!has(object, key)) return required ? failure('MISSING_REQUIRED_FIELD', path) : success(undefined);
  if (typeof object[key] !== 'string') return failure('INVALID_FIELD_TYPE', path);
  return /^[0-9a-f]*$/i.test(object[key] as string) && (object[key] as string).length % 2 === 0
    ? success(undefined)
    : failure('INVALID_HEX', path);
}

function isStandardTypeValue(value: string): value is StandardSnifType {
  return (STANDARD_TYPES as readonly string[]).includes(value);
}

function validateProtectedPayloadValue(value: unknown, path: string): SnifResult<ProtectedPayload> {
  const jsonValidation = validateJsonValue(value);
  if (!jsonValidation.ok) return jsonValidation;
  if (!isPlainObject(value)) return failure('INVALID_FIELD_TYPE', path);
  const payload = value as RecordValue;

  const cipher = requireString(payload, 'cipher', `${path}/cipher`);
  if (!cipher.ok) return cipher;
  const ciphertext = validateHex(payload, 'ciphertext', `${path}/ciphertext`, true);
  if (!ciphertext.ok) return ciphertext;

  if (has(payload, 'kdf')) {
    if (!isPlainObject(payload.kdf)) return failure('INVALID_FIELD_TYPE', `${path}/kdf`);
    const kdf = payload.kdf as RecordValue;
    const name = requireString(kdf, 'name', `${path}/kdf/name`);
    if (!name.ok) return failure(name.error.code, name.error.path);
    const salt = validateHex(kdf, 'salt', `${path}/kdf/salt`, false);
    if (!salt.ok) return failure(salt.error.code, salt.error.path);
    if (has(kdf, 'params') && !isPlainObject(kdf.params)) {
      return failure('INVALID_FIELD_TYPE', `${path}/kdf/params`);
    }
  }

  const nonce = validateHex(payload, 'nonce', `${path}/nonce`, false);
  if (!nonce.ok) return failure(nonce.error.code, nonce.error.path);
  const tag = validateHex(payload, 'tag', `${path}/tag`, false);
  if (!tag.ok) return failure(tag.error.code, tag.error.path);

  const isStandardProfile =
    cipher.value === 'aes-256-gcm' && isPlainObject(payload.kdf) && (payload.kdf as RecordValue).name === 'argon2id';
  if (isStandardProfile) {
    // 標準profileだけは仕様で定義された必須項目とbyte長まで検証する。
    // 未知profileの必須項目は推測せず、providerへ委ねる。
    const kdf = payload.kdf as RecordValue;
    const salt = validateHex(kdf, 'salt', `${path}/kdf/salt`, true);
    if (!salt.ok) return failure(salt.error.code, salt.error.path);
    if (!has(kdf, 'params')) return failure('MISSING_REQUIRED_FIELD', `${path}/kdf/params`);
    const params = kdf.params;
    if (!isPlainObject(params)) return failure('INVALID_FIELD_TYPE', `${path}/kdf/params`);
    for (const name of ['version', 'memoryCost', 'timeCost', 'parallelism']) {
      const parameterPath = `${path}/kdf/params/${name}`;
      if (!has(params, name)) return failure('MISSING_REQUIRED_FIELD', parameterPath);
      if (typeof params[name] !== 'number' || !Number.isInteger(params[name])) {
        return failure('INVALID_FIELD_TYPE', parameterPath);
      }
    }
    if (!has(payload, 'nonce')) return failure('MISSING_REQUIRED_FIELD', `${path}/nonce`);
    if (!has(payload, 'tag')) return failure('MISSING_REQUIRED_FIELD', `${path}/tag`);
    if (typeof payload.nonce !== 'string' || typeof payload.tag !== 'string') {
      return failure('INVALID_FIELD_TYPE', path);
    }
    if ((payload.nonce as string).length !== 24) {
      return failure('INVALID_PROTECTION_PARAMETERS', `${path}/nonce`);
    }
    if ((payload.tag as string).length !== 32) {
      return failure('INVALID_PROTECTION_PARAMETERS', `${path}/tag`);
    }
  }

  return success(payload as unknown as ProtectedPayload);
}

export function validateProtectedPayload(value: unknown, path = '/protectedPayload'): SnifResult<ProtectedPayload> {
  return validateProtectedPayloadValue(value, path);
}

function validatePayload(type: StandardSnifType, value: unknown, path: string): SnifResult<void> {
  if (!isPlainObject(value)) return failure('INVALID_FIELD_TYPE', path);
  const payload = value as RecordValue;

  // 各caseの順序は仕様のpayloadフィールド順と条件付きエラーの安定性に対応する。
  switch (type) {
    case 'address': {
      return discard(requireString(payload, 'address', `${path}/address`));
    }
    case 'contact': {
      const name = requireString(payload, 'name', `${path}/name`);
      if (!name.ok) return failure(name.error.code, name.error.path);
      for (const key of ['address', 'note', 'icon']) {
        const result = optionalString(payload, key, `${path}/${key}`);
        if (!result.ok) return result;
      }
      return validateHex(payload, 'publicKey', `${path}/publicKey`, false);
    }
    case 'account': {
      const privateKey = validateHex(payload, 'privateKey', `${path}/privateKey`, true);
      if (!privateKey.ok) return privateKey;
      const publicKey = validateHex(payload, 'publicKey', `${path}/publicKey`, true);
      if (!publicKey.ok) return publicKey;
      return discard(requireString(payload, 'address', `${path}/address`));
    }
    case 'mnemonic':
      return discard(requireString(payload, 'mnemonic', `${path}/mnemonic`));
    case 'transaction': {
      const transactionPayload = validateHex(payload, 'payload', `${path}/payload`, true);
      if (!transactionPayload.ok) return transactionPayload;
      const action = optionalString(payload, 'action', `${path}/action`);
      if (!action.ok) return action;
      const result = optionalString(payload, 'result', `${path}/result`);
      if (!result.ok) return result;
      const actionValue = has(payload, 'action') ? payload.action : undefined;
      if (actionValue === 'sign-response') {
        if (!has(payload, 'result')) return failure('MISSING_REQUIRED_FIELD', `${path}/result`);
        if (payload.result !== 'approved' && payload.result !== 'rejected') {
          return failure('INVALID_STANDARD_VALUE', `${path}/result`);
        }
        if (payload.result === 'rejected' && has(payload, 'signature')) {
          return failure('INVALID_FIELD_VALUE', `${path}/signature`);
        }
        if (payload.result === 'approved' && !has(payload, 'signature')) {
          return failure('MISSING_REQUIRED_FIELD', `${path}/signature`);
        }
        if (payload.result === 'approved') {
          const signature = validateHex(payload, 'signature', `${path}/signature`, true);
          if (!signature.ok) return signature;
        }
      } else {
        const signature = validateHex(payload, 'signature', `${path}/signature`, false);
        if (!signature.ok) return signature;
      }
      return success(undefined);
    }
    case 'connection-request': {
      const url = requireString(payload, 'url', `${path}/url`);
      if (!url.ok) return failure(url.error.code, url.error.path);
      if (!has(payload, 'permissions')) return failure('MISSING_REQUIRED_FIELD', `${path}/permissions`);
      if (!Array.isArray(payload.permissions)) return failure('INVALID_FIELD_TYPE', `${path}/permissions`);
      for (let index = 0; index < payload.permissions.length; index += 1) {
        if (typeof payload.permissions[index] !== 'string') {
          return failure('INVALID_FIELD_TYPE', `${path}/permissions/${index}`);
        }
      }
      for (const key of ['name', 'icon', 'note']) {
        const result = optionalString(payload, key, `${path}/${key}`);
        if (!result.ok) return result;
      }
      return success(undefined);
    }
    case 'connection-response': {
      if (!has(payload, 'status')) return failure('MISSING_REQUIRED_FIELD', `${path}/status`);
      if (payload.status !== 'approved' && payload.status !== 'rejected') {
        return typeof payload.status === 'string'
          ? failure('INVALID_STANDARD_VALUE', `${path}/status`)
          : failure('INVALID_FIELD_TYPE', `${path}/status`);
      }
      if (payload.status === 'rejected') {
        if (has(payload, 'address')) return failure('INVALID_FIELD_VALUE', `${path}/address`);
        if (has(payload, 'publicKey')) return failure('INVALID_FIELD_VALUE', `${path}/publicKey`);
        return success(undefined);
      }
      const address = optionalString(payload, 'address', `${path}/address`);
      if (!address.ok) return address;
      return validateHex(payload, 'publicKey', `${path}/publicKey`, false);
    }
  }
}

function validateEnvelopeObject(root: JsonObject): SnifResult<SnifData> {
  // version、共通エンベロープ、payload、type固有payloadの順に固定して検証する。
  if (!has(root, 'version')) return failure('MISSING_REQUIRED_FIELD', '/version');
  if (typeof root.version !== 'number') return failure('INVALID_FIELD_TYPE', '/version');
  if (root.version !== 1) return failure('UNSUPPORTED_VERSION', '/version');

  const type = requireString(root, 'type', '/type');
  if (!type.ok) return type;
  const chain = requireString(root, 'chain', '/chain');
  if (!chain.ok) return chain;
  const network = requireString(root, 'network', '/network');
  if (!network.ok) return network;
  if (network.value.length === 0) return failure('INVALID_FIELD_VALUE', '/network');

  const generationHashSeed = validateHex(root, 'generationHashSeed', '/generationHashSeed', false);
  if (!generationHashSeed.ok) return generationHashSeed;
  for (const key of ['id', 'replyTo']) {
    if (!has(root, key)) continue;
    if (typeof root[key] !== 'string') return failure('INVALID_FIELD_TYPE', `/${key}`);
    if ((root[key] as string).length === 0) return failure('INVALID_FIELD_VALUE', `/${key}`);
  }

  const hasPayload = has(root, 'payload');
  const hasProtectedPayload = has(root, 'protectedPayload');
  if (hasPayload && hasProtectedPayload) return failure('PAYLOAD_CONFLICT');
  if (!isStandardTypeValue(type.value)) {
    if (hasProtectedPayload) return failure('PROTECTED_PAYLOAD_NOT_ALLOWED', '/protectedPayload');
    if (!hasPayload) return failure('PAYLOAD_MISSING');
    if (!isPlainObject(root.payload)) return failure('INVALID_FIELD_TYPE', '/payload');
    return success(root as unknown as SnifData);
  }

  if ((type.value === 'account' || type.value === 'mnemonic') && hasProtectedPayload) {
    const protectedPayload = validateProtectedPayloadValue(root.protectedPayload, '/protectedPayload');
    if (!protectedPayload.ok) return protectedPayload;
    if (hasPayload) return failure('PAYLOAD_CONFLICT');
    return success(root as unknown as SnifData);
  }
  if (hasProtectedPayload) return failure('PROTECTED_PAYLOAD_NOT_ALLOWED', '/protectedPayload');
  if (!hasPayload) return failure('PAYLOAD_MISSING');

  const payload = validatePayload(type.value, root.payload, '/payload');
  if (!payload.ok) return payload;

  if (type.value === 'transaction' && isPlainObject(root.payload)) {
    const transactionPayload = root.payload as RecordValue;
    if (transactionPayload.action === 'sign' && !has(root, 'id')) {
      return failure('MISSING_REQUIRED_FIELD', '/id');
    }
    if (transactionPayload.action === 'sign-response') {
      if (!has(root, 'replyTo')) return failure('MISSING_REQUIRED_FIELD', '/replyTo');
    }
  }
  return success(root as unknown as SnifData);
}

export function validateValue(input: unknown): SnifResult<SnifData> {
  try {
    const jsonValidation = validateJsonValue(input);
    if (!jsonValidation.ok) return jsonValidation;
    if (!isPlainObject(input)) return failure('ROOT_NOT_OBJECT');
    return validateEnvelopeObject(input);
  } catch {
    return failure('INVALID_JSON_VALUE');
  }
}

export function validatePlainPayload(type: 'account' | 'mnemonic', value: unknown): SnifResult<void> {
  const jsonValidation = validateJsonValue(value);
  if (!jsonValidation.ok) return jsonValidation;
  return validatePayload(type, value, '/payload');
}

export function isStandardType(type: string): type is StandardSnifType {
  return isStandardTypeValue(type);
}
