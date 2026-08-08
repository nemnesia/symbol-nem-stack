import { describe, expect, it } from 'vitest';

import {
  getProtectionState,
  isProtected,
  parse,
  protect,
  serialize,
  standardProtectionProvider,
  unprotect,
  validate,
} from '../src/index.js';
import type { AccountSnif, ProtectionProvider, SnifData, SnifResult } from '../src/index.js';

// 標準7typeとアプリケーション固有typeの最小受理例。
const validValues: unknown[] = [
  {
    version: 1,
    type: 'address',
    chain: 'symbol',
    network: 'mainnet',
    payload: { address: 'SYMBOL-ADDRESS-FIXTURE' },
  },
  {
    version: 1,
    type: 'contact',
    chain: 'symbol',
    network: 'testnet',
    payload: { name: 'Alice', publicKey: '00112233' },
  },
  {
    version: 1,
    type: 'account',
    chain: 'symbol',
    network: 'testnet',
    payload: { privateKey: '00', publicKey: '11', address: 'ACCOUNT' },
  },
  {
    version: 1,
    type: 'mnemonic',
    chain: 'symbol',
    network: 'mainnet',
    payload: { mnemonic: 'fixture mnemonic text' },
  },
  {
    version: 1,
    type: 'transaction',
    chain: 'symbol',
    network: 'mainnet',
    generationHashSeed: '000102030405060708090a0b0c0d0e0f',
    id: 'tx-001',
    payload: { action: 'sign', payload: '00112233' },
  },
  {
    version: 1,
    type: 'connection-request',
    chain: 'symbol',
    network: 'mainnet',
    payload: { url: 'https://example.com', permissions: ['address', 'vendor-capability'] },
  },
  {
    version: 1,
    type: 'connection-response',
    chain: 'symbol',
    network: 'mainnet',
    payload: { status: 'approved', publicKey: 'AABB' },
  },
  {
    version: 1,
    type: 'com.example.custom',
    chain: 'custom-chain',
    network: 'custom-network',
    payload: { enabled: true, nested: { value: null } },
  },
];

function expectError(input: unknown, code: string, path?: string): void {
  const result = validate(input);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.code).toBe(code);
  if (path === undefined) expect(result.error.path).toBeUndefined();
  else expect(result.error.path).toBe(path);
}

describe('SNIF v1 フォーマットAPI', () => {
  it.each(validValues)('有効な値を受理する %#', (value) => {
    const result = validate(value);
    expect(result.ok).toBe(true);
  });

  it('JSONを解析・シリアライズし、canonical JSONを強制しない', () => {
    const input = '{"network":"mainnet","payload":{"address":"X"},"version":1,"chain":"symbol","type":"address"}';
    const parsed = parse(input);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const serialized = serialize(parsed.value);
    expect(serialized.ok).toBe(true);
    if (!serialized.ok) return;
    expect(JSON.parse(serialized.value)).toEqual(JSON.parse(input));
    expect(parse(1 as unknown as string)).toEqual({
      ok: false,
      error: { code: 'INVALID_JSON', message: 'Input is not valid JSON.' },
    });
    expect(parse('{')).toEqual({
      ok: false,
      error: { code: 'INVALID_JSON', message: 'Input is not valid JSON.' },
    });
  });

  it('validateとprotectが入力値を変更しない', async () => {
    const input: AccountSnif = {
      version: 1,
      type: 'account',
      chain: 'symbol',
      network: 'testnet',
      payload: { privateKey: '00', publicKey: '11', address: 'ACCOUNT' },
    };
    const before = JSON.stringify(input);
    expect(validate(input).ok).toBe(true);
    const result = await protect(input, 'password', standardProtectionProvider);
    expect(result.ok).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('仕様で定義された形式エラーを返す', () => {
    // 仕様でerror codeとJSON Pointerが固定されている代表的な拒否例。
    expectError(
      { version: 2, type: 'address', chain: 'symbol', network: 'mainnet', payload: { address: 'X' } },
      'UNSUPPORTED_VERSION',
      '/version'
    );
    expectError(
      { version: 1, type: 'address', chain: 'symbol', payload: { address: 'X' } },
      'MISSING_REQUIRED_FIELD',
      '/network'
    );
    expectError(
      { version: 1, type: 'address', chain: 'symbol', network: 'mainnet', payload: 'X' },
      'INVALID_FIELD_TYPE',
      '/payload'
    );
    expectError(
      { version: 1, type: 'transaction', chain: 'symbol', network: 'mainnet', payload: { payload: 'ABC' } },
      'INVALID_HEX',
      '/payload/payload'
    );
    expectError(
      {
        version: 1,
        type: 'transaction',
        chain: 'symbol',
        network: 'mainnet',
        payload: { action: 'sign', payload: '00' },
      },
      'MISSING_REQUIRED_FIELD',
      '/id'
    );
    expectError(
      {
        version: 1,
        type: 'transaction',
        chain: 'symbol',
        network: 'mainnet',
        payload: { action: 'sign-response', payload: '00', result: 'approved', signature: 'aa' },
      },
      'MISSING_REQUIRED_FIELD',
      '/replyTo'
    );
    expectError(
      {
        version: 1,
        type: 'transaction',
        chain: 'symbol',
        network: 'mainnet',
        replyTo: 'request',
        payload: { action: 'sign-response', payload: '00', result: 'rejected', signature: 'aa' },
      },
      'INVALID_FIELD_VALUE',
      '/payload/signature'
    );
    expectError(
      {
        version: 1,
        type: 'connection-response',
        chain: 'symbol',
        network: 'mainnet',
        payload: { status: 'rejected', address: 'X' },
      },
      'INVALID_FIELD_VALUE',
      '/payload/address'
    );
    expectError(
      {
        version: 1,
        type: 'transaction',
        chain: 'symbol',
        network: 'mainnet',
        protectedPayload: { cipher: 'x', ciphertext: '00' },
      },
      'PROTECTED_PAYLOAD_NOT_ALLOWED',
      '/protectedPayload'
    );
  });

  it('JSON値モデル外の値を拒否する', () => {
    expectError(
      { version: 1, type: 'address', chain: 'symbol', network: 'mainnet', payload: { address: NaN } },
      'NON_FINITE_NUMBER'
    );
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expectError(circular, 'CIRCULAR_REFERENCE');
    expectError(
      { version: 1, type: 'address', chain: 'symbol', network: 'mainnet', payload: { address: 1n } },
      'INVALID_JSON_VALUE'
    );
  });

  it('配列の追加プロパティをJSON値モデル外として拒否する', () => {
    const customPayload = {
      version: 1,
      type: 'com.example.custom',
      chain: 'custom-chain',
      network: 'custom-network',
      payload: { values: [] as unknown[] },
    };

    const stringProperty = structuredClone(customPayload);
    (stringProperty.payload.values as unknown[] & { note?: string }).note = '追加情報';
    expectError(stringProperty, 'INVALID_JSON_VALUE');

    const symbolProperty = structuredClone(customPayload);
    const symbol = Symbol('追加プロパティ');
    Object.defineProperty(symbolProperty.payload.values, symbol, { value: '追加情報' });
    expectError(symbolProperty, 'INVALID_JSON_VALUE');

    const toJsonProperty = structuredClone(customPayload);
    (toJsonProperty.payload.values as unknown[] & { toJSON?: () => unknown }).toJSON = () => ({ changed: true });
    expectError(toJsonProperty, 'INVALID_JSON_VALUE');

    const sparseArray = structuredClone(customPayload);
    sparseArray.payload.values = new Array(1);
    expectError(sparseArray, 'INVALID_JSON_VALUE');

    const nestedInvalidValue = structuredClone(customPayload);
    nestedInvalidValue.payload.values = [undefined];
    expectError(nestedInvalidValue, 'INVALID_JSON_VALUE');

    const serialized = serialize(toJsonProperty as SnifData);
    expect(serialized.ok).toBe(false);
    if (!serialized.ok) expect(serialized.error.code).toBe('INVALID_JSON_VALUE');

    const ordinaryArray = structuredClone(customPayload);
    ordinaryArray.payload.values = [null, true, 'value', 1];
    expect(validate(ordinaryArray).ok).toBe(true);

    const throwingGetter = {
      version: 1,
      type: 'com.example.custom',
      chain: 'custom-chain',
      network: 'custom-network',
      payload: Object.defineProperty({}, 'value', {
        enumerable: true,
        get: () => {
          throw new Error('getter error');
        },
      }),
    };
    expectError(throwingGetter, 'INVALID_JSON_VALUE');
  });

  it('保護状態ヘルパーが保護状態を返す', () => {
    const plain = validValues[2] as SnifData;
    expect(getProtectionState(plain)).toBe('plain');
    expect(isProtected(plain)).toBe(false);
    expect(getProtectionState(validValues[0] as SnifData)).toBe('not-applicable');
    const protectedAccount = {
      ...plain,
      protectedPayload: { cipher: 'x', ciphertext: '00' },
    } as SnifData;
    expect(isProtected(protectedAccount)).toBe(true);
    expect(getProtectionState(protectedAccount)).toBe('protected');
  });

  it('仕様書の正常系fixture行列を受理する', () => {
    // spec-format.md 9.3の受理条件を、実装内部の分岐とは独立した入力fixtureで確認する。
    const fixtures: Array<{ id: string; input: unknown }> = [
      {
        id: 'valid-address-nem',
        input: {
          version: 1,
          type: 'address',
          chain: 'nem',
          network: 'mainnet',
          payload: { address: 'NEM-ADDRESS-FIXTURE' },
        },
      },
      {
        id: 'valid-transaction-nem',
        input: {
          version: 1,
          type: 'transaction',
          chain: 'nem',
          network: 'testnet',
          id: 'tx-nem-001',
          payload: { action: 'display', payload: 'A1B2C3D4' },
        },
      },
      {
        id: 'valid-transaction-sign-response-approved',
        input: {
          version: 1,
          type: 'transaction',
          chain: 'symbol',
          network: 'mainnet',
          replyTo: 'tx-symbol-001',
          payload: { action: 'sign-response', payload: '00112233', result: 'approved', signature: 'aabbccdd' },
        },
      },
      {
        id: 'valid-transaction-sign-response-rejected',
        input: {
          version: 1,
          type: 'transaction',
          chain: 'symbol',
          network: 'mainnet',
          replyTo: 'tx-symbol-001',
          payload: { action: 'sign-response', payload: '00112233', result: 'rejected' },
        },
      },
      {
        id: 'valid-unknown-action',
        input: {
          version: 1,
          type: 'transaction',
          chain: 'symbol',
          network: 'mainnet',
          payload: { action: 'vendor-preview', payload: '00' },
        },
      },
      {
        id: 'valid-unknown-permission',
        input: {
          version: 1,
          type: 'connection-request',
          chain: 'symbol',
          network: 'mainnet',
          payload: { url: 'https://example.com', permissions: ['vendor-capability'] },
        },
      },
      {
        id: 'valid-custom-type',
        input: {
          version: 1,
          type: 'com.example.metadata',
          chain: 'custom-chain',
          network: 'custom-network',
          payload: { name: 'fixture', count: 1, enabled: true, nested: { value: null } },
        },
      },
    ];

    for (const fixture of fixtures) {
      expect(validate(fixture.input).ok, fixture.id).toBe(true);
      const parsed = parse(JSON.stringify(fixture.input));
      expect(parsed.ok, `${fixture.id}のparse`).toBe(true);
      if (parsed.ok) expect(serialize(parsed.value).ok, `${fixture.id}のserialize`).toBe(true);
    }
  });

  it('仕様書の拒否系fixture行列を拒否する', () => {
    // reasonの文言ではなく、仕様で示された公開codeとJSON Pointerを期待値として固定する。
    const fixtures: Array<{ id: string; input: unknown; code: string; path?: string }> = [
      {
        id: 'reject-missing-version',
        input: { type: 'address', chain: 'symbol', network: 'mainnet', payload: { address: 'X' } },
        code: 'MISSING_REQUIRED_FIELD',
        path: '/version',
      },
      {
        id: 'reject-unsupported-version',
        input: { version: 2, type: 'address', chain: 'symbol', network: 'mainnet', payload: { address: 'X' } },
        code: 'UNSUPPORTED_VERSION',
        path: '/version',
      },
      {
        id: 'reject-type-not-string',
        input: { version: 1, type: 1, chain: 'symbol', network: 'mainnet', payload: { address: 'X' } },
        code: 'INVALID_FIELD_TYPE',
        path: '/type',
      },
      {
        id: 'reject-odd-length-hex',
        input: { version: 1, type: 'transaction', chain: 'symbol', network: 'mainnet', payload: { payload: 'ABC' } },
        code: 'INVALID_HEX',
        path: '/payload/payload',
      },
      {
        id: 'reject-0x-hex',
        input: { version: 1, type: 'transaction', chain: 'symbol', network: 'mainnet', payload: { payload: '0x0011' } },
        code: 'INVALID_HEX',
        path: '/payload/payload',
      },
      {
        id: 'reject-account-payload-conflict',
        input: {
          version: 1,
          type: 'account',
          chain: 'symbol',
          network: 'mainnet',
          payload: { privateKey: '00', publicKey: '11', address: 'X' },
          protectedPayload: { cipher: 'custom-aead', ciphertext: '22' },
        },
        code: 'PAYLOAD_CONFLICT',
      },
      {
        id: 'reject-protected-payload-on-transaction',
        input: {
          version: 1,
          type: 'transaction',
          chain: 'symbol',
          network: 'mainnet',
          protectedPayload: { cipher: 'custom-aead', ciphertext: '00' },
        },
        code: 'PROTECTED_PAYLOAD_NOT_ALLOWED',
        path: '/protectedPayload',
      },
      {
        id: 'reject-connection-request-missing-url',
        input: {
          version: 1,
          type: 'connection-request',
          chain: 'symbol',
          network: 'mainnet',
          payload: { permissions: ['address'] },
        },
        code: 'MISSING_REQUIRED_FIELD',
        path: '/payload/url',
      },
      {
        id: 'reject-connection-response-status',
        input: {
          version: 1,
          type: 'connection-response',
          chain: 'symbol',
          network: 'mainnet',
          replyTo: 'connection-request-001',
          payload: { status: 'pending' },
        },
        code: 'INVALID_STANDARD_VALUE',
        path: '/payload/status',
      },
      {
        id: 'reject-sign-response-missing-reply-to',
        input: {
          version: 1,
          type: 'transaction',
          chain: 'symbol',
          network: 'mainnet',
          payload: { action: 'sign-response', payload: '00112233', result: 'approved', signature: 'aabbccdd' },
        },
        code: 'MISSING_REQUIRED_FIELD',
        path: '/replyTo',
      },
      {
        id: 'reject-sign-response-rejected-with-signature',
        input: {
          version: 1,
          type: 'transaction',
          chain: 'symbol',
          network: 'mainnet',
          replyTo: 'tx-symbol-001',
          payload: { action: 'sign-response', payload: '00112233', result: 'rejected', signature: 'aabbccdd' },
        },
        code: 'INVALID_FIELD_VALUE',
        path: '/payload/signature',
      },
      {
        id: 'reject-custom-payload-not-object',
        input: { version: 1, type: 'com.example.custom', chain: 'custom', network: 'custom', payload: 'not-an-object' },
        code: 'INVALID_FIELD_TYPE',
        path: '/payload',
      },
    ];

    for (const fixture of fixtures) expectError(fixture.input, fixture.code, fixture.path);
  });

  it('仕様で定義された型・必須性・境界値を検証する', () => {
    expectError(null, 'ROOT_NOT_OBJECT');
    expectError({ version: '1' }, 'INVALID_FIELD_TYPE', '/version');
    expectError({ version: 1 }, 'MISSING_REQUIRED_FIELD', '/type');
    expectError({ version: 1, type: 'address' }, 'MISSING_REQUIRED_FIELD', '/chain');
    expectError({ version: 1, type: 'address', chain: 'symbol' }, 'MISSING_REQUIRED_FIELD', '/network');
    expectError({ version: 1, type: 'address', chain: 'symbol', network: '' }, 'INVALID_FIELD_VALUE', '/network');
    expectError(
      {
        version: 1,
        type: 'address',
        chain: 'symbol',
        network: 'mainnet',
        generationHashSeed: '0x00',
        payload: { address: 'X' },
      },
      'INVALID_HEX',
      '/generationHashSeed'
    );
    expectError(
      { version: 1, type: 'address', chain: 'symbol', network: 'mainnet', id: '', payload: { address: 'X' } },
      'INVALID_FIELD_VALUE',
      '/id'
    );
    expectError(
      { version: 1, type: 'address', chain: 'symbol', network: 'mainnet', replyTo: 1, payload: { address: 'X' } },
      'INVALID_FIELD_TYPE',
      '/replyTo'
    );

    expectError(
      { version: 1, type: 'contact', chain: 'symbol', network: 'mainnet', payload: {} },
      'MISSING_REQUIRED_FIELD',
      '/payload/name'
    );
    expectError(
      { version: 1, type: 'contact', chain: 'symbol', network: 'mainnet', payload: { name: 1 } },
      'INVALID_FIELD_TYPE',
      '/payload/name'
    );
    expectError(
      { version: 1, type: 'contact', chain: 'symbol', network: 'mainnet', payload: { name: 'x', note: 1 } },
      'INVALID_FIELD_TYPE',
      '/payload/note'
    );
    expectError(
      { version: 1, type: 'contact', chain: 'symbol', network: 'mainnet', payload: { name: 'x', publicKey: 'GG' } },
      'INVALID_HEX',
      '/payload/publicKey'
    );
    expectError(
      { version: 1, type: 'account', chain: 'symbol', network: 'mainnet', payload: { publicKey: '00', address: 'X' } },
      'MISSING_REQUIRED_FIELD',
      '/payload/privateKey'
    );
    expectError(
      { version: 1, type: 'account', chain: 'symbol', network: 'mainnet', payload: { privateKey: '00', address: 'X' } },
      'MISSING_REQUIRED_FIELD',
      '/payload/publicKey'
    );
    expectError(
      {
        version: 1,
        type: 'account',
        chain: 'symbol',
        network: 'mainnet',
        payload: { privateKey: '00', publicKey: '00' },
      },
      'MISSING_REQUIRED_FIELD',
      '/payload/address'
    );
    expectError(
      { version: 1, type: 'mnemonic', chain: 'symbol', network: 'mainnet', payload: {} },
      'MISSING_REQUIRED_FIELD',
      '/payload/mnemonic'
    );

    expectError(
      { version: 1, type: 'transaction', chain: 'symbol', network: 'mainnet', payload: { payload: '00', action: 1 } },
      'INVALID_FIELD_TYPE',
      '/payload/action'
    );
    expectError(
      { version: 1, type: 'transaction', chain: 'symbol', network: 'mainnet', payload: { payload: '00', result: 1 } },
      'INVALID_FIELD_TYPE',
      '/payload/result'
    );
    expectError(
      {
        version: 1,
        type: 'transaction',
        chain: 'symbol',
        network: 'mainnet',
        payload: { action: 'sign-response', payload: '00' },
      },
      'MISSING_REQUIRED_FIELD',
      '/payload/result'
    );
    expectError(
      {
        version: 1,
        type: 'transaction',
        chain: 'symbol',
        network: 'mainnet',
        replyTo: 'r',
        payload: { action: 'sign-response', payload: '00', result: 'pending' },
      },
      'INVALID_STANDARD_VALUE',
      '/payload/result'
    );
    expectError(
      {
        version: 1,
        type: 'transaction',
        chain: 'symbol',
        network: 'mainnet',
        replyTo: 'r',
        payload: { action: 'sign-response', payload: '00', result: 'approved', signature: 'GG' },
      },
      'INVALID_HEX',
      '/payload/signature'
    );

    expectError(
      {
        version: 1,
        type: 'connection-request',
        chain: 'symbol',
        network: 'mainnet',
        payload: { url: 'x', permissions: 'address' },
      },
      'INVALID_FIELD_TYPE',
      '/payload/permissions'
    );
    expectError(
      {
        version: 1,
        type: 'connection-request',
        chain: 'symbol',
        network: 'mainnet',
        payload: { url: 'x', permissions: [1] },
      },
      'INVALID_FIELD_TYPE',
      '/payload/permissions/0'
    );
    expectError(
      {
        version: 1,
        type: 'connection-request',
        chain: 'symbol',
        network: 'mainnet',
        payload: { url: 'x', permissions: [], icon: 1 },
      },
      'INVALID_FIELD_TYPE',
      '/payload/icon'
    );
    expectError(
      { version: 1, type: 'connection-response', chain: 'symbol', network: 'mainnet', payload: {} },
      'MISSING_REQUIRED_FIELD',
      '/payload/status'
    );
    expectError(
      { version: 1, type: 'connection-response', chain: 'symbol', network: 'mainnet', payload: { status: 1 } },
      'INVALID_FIELD_TYPE',
      '/payload/status'
    );
    expectError(
      {
        version: 1,
        type: 'connection-response',
        chain: 'symbol',
        network: 'mainnet',
        payload: { status: 'rejected', publicKey: '00' },
      },
      'INVALID_FIELD_VALUE',
      '/payload/publicKey'
    );
    expectError(
      {
        version: 1,
        type: 'connection-response',
        chain: 'symbol',
        network: 'mainnet',
        payload: { status: 'approved', address: 1 },
      },
      'INVALID_FIELD_TYPE',
      '/payload/address'
    );

    expectError({ version: 1, type: 'com.example.custom', chain: 'custom', network: 'custom' }, 'PAYLOAD_MISSING');
    expectError(
      {
        version: 1,
        type: 'com.example.custom',
        chain: 'custom',
        network: 'custom',
        protectedPayload: { cipher: 'x', ciphertext: '00' },
      },
      'PROTECTED_PAYLOAD_NOT_ALLOWED',
      '/protectedPayload'
    );
  });

  it('protectedPayloadの共通構造と標準profileの必須項目を検証する', () => {
    const base = { version: 1, type: 'account', chain: 'symbol', network: 'mainnet' };
    const expectProtected = (protectedPayload: unknown, code: string, path?: string): void => {
      expectError({ ...base, protectedPayload }, code, path);
    };
    expectProtected({ ciphertext: '00' }, 'MISSING_REQUIRED_FIELD', '/protectedPayload/cipher');
    expectProtected({ cipher: 1, ciphertext: '00' }, 'INVALID_FIELD_TYPE', '/protectedPayload/cipher');
    expectProtected({ cipher: 'x' }, 'MISSING_REQUIRED_FIELD', '/protectedPayload/ciphertext');
    expectProtected({ cipher: 'x', ciphertext: '0' }, 'INVALID_HEX', '/protectedPayload/ciphertext');
    expectProtected({ cipher: 'x', ciphertext: '00', kdf: 1 }, 'INVALID_FIELD_TYPE', '/protectedPayload/kdf');
    expectProtected({ cipher: 'x', ciphertext: '00', kdf: {} }, 'MISSING_REQUIRED_FIELD', '/protectedPayload/kdf/name');
    expectProtected(
      { cipher: 'x', ciphertext: '00', kdf: { name: 'x', salt: '0' } },
      'INVALID_HEX',
      '/protectedPayload/kdf/salt'
    );
    expectProtected(
      { cipher: 'x', ciphertext: '00', kdf: { name: 'x', params: 1 } },
      'INVALID_FIELD_TYPE',
      '/protectedPayload/kdf/params'
    );
    expectProtected({ cipher: 'x', ciphertext: '00', nonce: '0' }, 'INVALID_HEX', '/protectedPayload/nonce');
    expectProtected({ cipher: 'x', ciphertext: '00', tag: '0' }, 'INVALID_HEX', '/protectedPayload/tag');

    const standard = {
      cipher: 'aes-256-gcm',
      kdf: { name: 'argon2id', salt: '00', params: { version: 19, memoryCost: 8, timeCost: 1, parallelism: 1 } },
      nonce: '00',
      ciphertext: '00',
      tag: '00',
    };
    const { salt: _salt, ...kdfWithoutSalt } = standard.kdf;
    expectProtected({ ...standard, kdf: kdfWithoutSalt }, 'MISSING_REQUIRED_FIELD', '/protectedPayload/kdf/salt');
    expectProtected(
      { ...standard, kdf: { name: 'argon2id', salt: '00' } },
      'MISSING_REQUIRED_FIELD',
      '/protectedPayload/kdf/params'
    );
    for (const parameter of ['version', 'memoryCost', 'timeCost', 'parallelism']) {
      const params = { ...standard.kdf.params } as Record<string, unknown>;
      delete params[parameter];
      expectProtected(
        { ...standard, kdf: { ...standard.kdf, params } },
        'MISSING_REQUIRED_FIELD',
        `/protectedPayload/kdf/params/${parameter}`
      );
    }
    expectProtected(
      {
        ...standard,
        kdf: { ...standard.kdf, params: { ...standard.kdf.params, version: '19' } },
        nonce: '00'.repeat(12),
        tag: '00'.repeat(16),
      },
      'INVALID_FIELD_TYPE',
      '/protectedPayload/kdf/params/version'
    );
    const { nonce: _nonce, ...withoutNonce } = standard;
    expectProtected(withoutNonce, 'MISSING_REQUIRED_FIELD', '/protectedPayload/nonce');
    const { tag: _tag, ...withoutTag } = { ...standard, nonce: '00'.repeat(12) };
    expectProtected(withoutTag, 'MISSING_REQUIRED_FIELD', '/protectedPayload/tag');
  });
});

describe('SNIF v1標準保護provider', () => {
  // 仕様書9.5の公開fixture。実資産や実アカウントには使用しない。
  const accountEnvelope = {
    version: 1,
    type: 'account' as const,
    chain: 'symbol',
    network: 'mainnet',
    protectedPayload: {
      cipher: 'aes-256-gcm',
      kdf: {
        name: 'argon2id',
        salt: '000102030405060708090a0b0c0d0e0f',
        params: { version: 19, memoryCost: 65536, timeCost: 3, parallelism: 1 },
      },
      nonce: '101112131415161718191a1b',
      ciphertext:
        '43bc5c40dad1346b831c8c26659cd0900d08c6e38a818ab314475ad9281b1f7ca212b6a71a4d52a5ee3c48a1d0de10eb9c32439a12103cedfcdb96a2de58617fb60a88bb11756262732b44a3fa5065ecba5947b3110026612f67ff6aa54159232a3d91f4a88d767c8de54a175f92f7c0af871dd86da9cd9fa97fcded2b44845970064f581c47599b05690aff54d21a3cf9774b3d86e620b560726e5224a53aee9cae361f71ca352f1ce3fcac55b363065304dfcad0a1965c97189c203c17c1307c',
      tag: '1aa6921f91c515e71e56bbc42ab8380e',
    },
  } satisfies AccountSnif;

  /** unprotectの復号後判定だけを検証するための、最小providerを生成します。 */
  function providerReturning(result: SnifResult<Uint8Array>): ProtectionProvider<string> {
    return {
      supports: () => true,
      validate: () => ({ ok: true, value: undefined }),
      protect: async () => ({ ok: false, error: { code: 'PROTECTION_FAILED', message: 'テスト用エラー' } }),
      unprotect: async () => result,
    };
  }

  /** providerの失敗変換を、provider固有のpath/messageを含めて検証します。 */
  function providerWithValidationFailure(
    code:
      | 'UNSUPPORTED_PROTECTION'
      | 'INVALID_PROTECTION_PARAMETERS'
      | 'RESOURCE_LIMIT_EXCEEDED'
      | 'AUTHENTICATION_FAILED'
      | 'PROTECTION_FAILED'
  ): ProtectionProvider<string> {
    return {
      supports: () => true,
      validate: () => ({ ok: false, error: { code, path: '/secret', message: '秘密情報を含むprovider詳細' } }),
      protect: async () => ({ ok: false, error: { code, path: '/secret', message: '秘密情報を含むprovider詳細' } }),
      unprotect: async () => ({ ok: false, error: { code, path: '/secret', message: '秘密情報を含むprovider詳細' } }),
    };
  }

  it('accountの相互運用fixtureを復号する', async () => {
    const result = await unprotect(accountEnvelope, 'SNIF test password', standardProtectionProvider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.payload).toEqual({
      privateKey: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      publicKey: '202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f',
      address: 'TEST-ACCOUNT-ADDRESS',
    });
  });

  it('認証失敗をprovider詳細なしで返す', async () => {
    const result = await unprotect(accountEnvelope, 'wrong password', standardProtectionProvider);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AUTHENTICATION_FAILED');
    expect(result.error.message).not.toContain('wrong password');
  });

  it('認証済みでも構造不正な復号後payloadを拒否する', async () => {
    const invalidPayloadEnvelope = {
      ...accountEnvelope,
      protectedPayload: {
        ...accountEnvelope.protectedPayload,
        nonce: '303132333435363738393a3b',
        ciphertext: '9a34577031f25134b493509fe044b494a2901029ab91',
        tag: 'c1ad2c874bd7bd0314570ffd2a721803',
      },
    } satisfies AccountSnif;
    const result = await unprotect(invalidPayloadEnvelope, 'SNIF test password', standardProtectionProvider);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('DECRYPTED_PAYLOAD_INVALID');
  });

  it('provider未対応を固定エラーへ変換する', async () => {
    const provider: ProtectionProvider<string> = {
      supports: () => false,
      validate: () => ({ ok: true, value: undefined }),
      protect: async () => ({ ok: false, error: { code: 'PROTECTION_FAILED', message: 'テスト用エラー' } }),
      unprotect: async () => ({ ok: false, error: { code: 'PROTECTION_FAILED', message: 'テスト用エラー' } }),
    };
    const result = await unprotect(accountEnvelope, 'password', provider);
    expect(result).toEqual({
      ok: false,
      error: { code: 'UNSUPPORTED_PROTECTION', message: 'The protection profile is not supported.' },
    });
  });

  it('protectのprovider例外と戻り値形式不正を安全に処理する', async () => {
    const plain = {
      version: 1 as const,
      type: 'account' as const,
      chain: 'symbol',
      network: 'mainnet',
      payload: { privateKey: '00', publicKey: '11', address: 'ACCOUNT' },
    };
    const throwingProvider: ProtectionProvider<string> = {
      supports: () => true,
      validate: () => ({ ok: true, value: undefined }),
      protect: async () => {
        throw new Error('秘密情報 leaked');
      },
      unprotect: async () => ({ ok: false, error: { code: 'PROTECTION_FAILED', message: 'テスト用エラー' } }),
    };
    const thrown = await protect(plain, 'password', throwingProvider);
    expect(thrown).toEqual({
      ok: false,
      error: { code: 'PROTECTION_FAILED', message: 'Protection processing failed.' },
    });

    const invalidResultProvider: ProtectionProvider<string> = {
      supports: () => true,
      validate: () => ({ ok: true, value: undefined }),
      protect: async () => ({ ok: true, value: { cipher: 'x', ciphertext: '0' } }),
      unprotect: async () => ({ ok: false, error: { code: 'PROTECTION_FAILED', message: 'テスト用エラー' } }),
    };
    const invalidResult = await protect(plain, 'password', invalidResultProvider);
    expect(invalidResult).toEqual({
      ok: false,
      error: {
        code: 'INVALID_HEX',
        path: '/protectedPayload/ciphertext',
        message: 'A field is not a valid hex string.',
      },
    });
  });

  it('protectとunprotectの入力状態・秘密情報型を検証する', async () => {
    const plain = {
      version: 1 as const,
      type: 'account' as const,
      chain: 'symbol',
      network: 'mainnet',
      payload: { privateKey: '00', publicKey: '11', address: 'ACCOUNT' },
    };
    const protectedData = {
      version: 1 as const,
      type: 'account' as const,
      chain: 'symbol',
      network: 'mainnet',
      protectedPayload: { cipher: 'x', ciphertext: '00' },
    } as AccountSnif;
    const plainProvider: ProtectionProvider<string> = {
      supports: () => true,
      validate: () => ({ ok: true, value: undefined }),
      protect: async () => ({ ok: true, value: { cipher: 'x', ciphertext: '00' } }),
      unprotect: async () => ({ ok: true, value: new TextEncoder().encode(JSON.stringify(plain.payload)) }),
    };
    const protectedInput = await protect(protectedData as never, 'password', plainProvider);
    expect(protectedInput).toEqual({
      ok: false,
      error: { code: 'INVALID_FIELD_VALUE', path: '/protectedPayload', message: 'A field has an invalid value.' },
    });
    const plainInput = await unprotect(plain as never, 'password', plainProvider);
    expect(plainInput).toEqual({
      ok: false,
      error: { code: 'INVALID_FIELD_VALUE', path: '/protectedPayload', message: 'A field has an invalid value.' },
    });

    const invalidSecret = await protect(plain, 1 as never, standardProtectionProvider);
    expect(invalidSecret).toEqual({
      ok: false,
      error: { code: 'PROTECTION_FAILED', message: 'Protection processing failed.' },
    });
    const invalidSecretForUnprotect = await unprotect(accountEnvelope, 1 as never, standardProtectionProvider);
    expect(invalidSecretForUnprotect).toEqual({
      ok: false,
      error: { code: 'AUTHENTICATION_FAILED', message: 'Authentication failed.' },
    });
  });

  it.each([
    'UNSUPPORTED_PROTECTION',
    'INVALID_PROTECTION_PARAMETERS',
    'RESOURCE_LIMIT_EXCEEDED',
    'AUTHENTICATION_FAILED',
    'PROTECTION_FAILED',
  ] as const)('provider allowlistの%sを安全に公開する', async (code) => {
    const provider = providerWithValidationFailure(code);
    const unprotectResult = await unprotect(accountEnvelope, 'password', provider);
    expect(unprotectResult.ok).toBe(false);
    if (!unprotectResult.ok) {
      expect(unprotectResult.error.code).toBe(code);
      expect(unprotectResult.error.path).toBeUndefined();
      expect(unprotectResult.error.message).not.toContain('秘密情報');
    }

    const plain = {
      version: 1 as const,
      type: 'account' as const,
      chain: 'symbol',
      network: 'mainnet',
      payload: { privateKey: '00', publicKey: '11', address: 'ACCOUNT' },
    };
    const protectResult = await protect(plain, 'password', provider);
    expect(protectResult.ok).toBe(false);
    if (!protectResult.ok) {
      expect(protectResult.error.code).toBe(code);
      expect(protectResult.error.path).toBeUndefined();
      expect(protectResult.error.message).not.toContain('秘密情報');
    }
  });

  it('allowlist外のprovider codeをPROTECTION_FAILEDへ変換する', async () => {
    const provider = providerWithValidationFailure('PROTECTION_FAILED');
    provider.validate = () => ({
      ok: false,
      error: { code: 'INVALID_JSON', path: '/secret', message: '秘密情報を含むprovider詳細' },
    });
    const result = await unprotect(accountEnvelope, 'password', provider);
    expect(result).toEqual({
      ok: false,
      error: { code: 'PROTECTION_FAILED', message: 'Protection processing failed.' },
    });
  });

  it('標準providerの資源制限と暗号パラメータを検証する', async () => {
    const resourceLimited = {
      ...accountEnvelope,
      protectedPayload: {
        ...accountEnvelope.protectedPayload,
        kdf: {
          ...accountEnvelope.protectedPayload.kdf,
          params: { ...accountEnvelope.protectedPayload.kdf.params, memoryCost: 262145 },
        },
      },
    } satisfies AccountSnif;
    const resourceResult = await unprotect(resourceLimited, 'password', standardProtectionProvider);
    expect(resourceResult).toEqual({
      ok: false,
      error: { code: 'RESOURCE_LIMIT_EXCEEDED', message: 'Protection parameters exceed the provider policy.' },
    });

    const invalidNonce = {
      ...accountEnvelope,
      protectedPayload: { ...accountEnvelope.protectedPayload, nonce: '00' },
    } satisfies AccountSnif;
    const nonceResult = await unprotect(invalidNonce, 'password', standardProtectionProvider);
    expect(nonceResult.ok).toBe(false);
    if (!nonceResult.ok) {
      expect(nonceResult.error.code).toBe('INVALID_PROTECTION_PARAMETERS');
      expect(nonceResult.error.path).toBe('/protectedPayload/nonce');
    }

    const invalidTag = {
      ...accountEnvelope,
      protectedPayload: { ...accountEnvelope.protectedPayload, tag: '00' },
    } satisfies AccountSnif;
    const tagResult = await unprotect(invalidTag, 'password', standardProtectionProvider);
    expect(tagResult.ok).toBe(false);
    if (!tagResult.ok) {
      expect(tagResult.error.code).toBe('INVALID_PROTECTION_PARAMETERS');
      expect(tagResult.error.path).toBe('/protectedPayload/tag');
    }

    const invalidKdf = {
      ...accountEnvelope,
      protectedPayload: {
        ...accountEnvelope.protectedPayload,
        kdf: {
          ...accountEnvelope.protectedPayload.kdf,
          params: { ...accountEnvelope.protectedPayload.kdf.params, version: 18 },
        },
      },
    } satisfies AccountSnif;
    const kdfResult = await unprotect(invalidKdf, 'password', standardProtectionProvider);
    expect(kdfResult).toEqual({
      ok: false,
      error: { code: 'INVALID_PROTECTION_PARAMETERS', message: 'Protection parameters are invalid.' },
    });
  });

  it.each([
    { 説明: '不正UTF-8', bytes: new Uint8Array([0xff, 0xfe]) },
    { 説明: '不正JSON', bytes: new TextEncoder().encode('not-json') },
  ])('復号後の$説明をDECRYPTED_PAYLOAD_INVALIDへ変換する', async ({ bytes }) => {
    const provider = providerReturning({ ok: true, value: bytes });
    const result = await unprotect(accountEnvelope, 'password', provider);
    expect(result).toEqual({
      ok: false,
      error: { code: 'DECRYPTED_PAYLOAD_INVALID', message: 'The decrypted payload is invalid.' },
    });
  });

  it('保護したmnemonicを往復変換する', async () => {
    const plain = {
      version: 1 as const,
      type: 'mnemonic' as const,
      chain: 'symbol',
      network: 'mainnet',
      payload: { mnemonic: 'fixture mnemonic text' },
    };
    const protectedResult = await protect(plain, 'password', standardProtectionProvider);
    expect(protectedResult.ok).toBe(true);
    if (!protectedResult.ok) return;
    const restored = await unprotect(protectedResult.value, 'password', standardProtectionProvider);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.value.payload).toEqual(plain.payload);
  });

  it('providerのエラーと例外を安全な形式へ変換する', async () => {
    // provider側のmessage/pathが公開結果へ漏れないことを確認する。
    const provider: ProtectionProvider<string> = {
      supports: () => true,
      validate: () => ({ ok: false, error: { code: 'PROTECTION_FAILED', path: '/secret', message: 'secret value' } }),
      protect: async () => ({ ok: false, error: { code: 'PROTECTION_FAILED', message: 'password leaked' } }),
      unprotect: async () => {
        throw new Error('private key leaked');
      },
    };
    const protectedData = accountEnvelope;
    const result = await unprotect(protectedData, 'password', provider);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PROTECTION_FAILED');
    expect(result.error.path).toBeUndefined();
    expect(result.error.message).not.toContain('leaked');
  });

  const exceptionProviders: Array<{ 説明: string; provider: ProtectionProvider<string> }> = [
    {
      説明: 'supportsの例外',
      provider: {
        supports: () => {
          throw new Error('秘密情報 leaked');
        },
        validate: () => ({ ok: true, value: undefined }),
        protect: async () => ({ ok: false, error: { code: 'PROTECTION_FAILED', message: 'テスト用エラー' } }),
        unprotect: async () => ({ ok: false, error: { code: 'PROTECTION_FAILED', message: 'テスト用エラー' } }),
      },
    },
    {
      説明: 'validateの例外',
      provider: {
        supports: () => true,
        validate: () => {
          throw new Error('秘密情報 leaked');
        },
        protect: async () => ({ ok: false, error: { code: 'PROTECTION_FAILED', message: 'テスト用エラー' } }),
        unprotect: async () => ({ ok: false, error: { code: 'PROTECTION_FAILED', message: 'テスト用エラー' } }),
      },
    },
  ];

  it.each(exceptionProviders)('$説明をPROTECTION_FAILEDへ変換する', async ({ provider }) => {
    const result = await unprotect(accountEnvelope, 'password', provider);
    expect(result).toEqual({
      ok: false,
      error: { code: 'PROTECTION_FAILED', message: 'Protection processing failed.' },
    });
  });
});
