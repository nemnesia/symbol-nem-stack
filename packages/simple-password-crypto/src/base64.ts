const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function valueOf(character: string): number {
  return BASE64_ALPHABET.indexOf(character);
}

function hasValidBase64Shape(base64: string): boolean {
  if (base64.length % 4 !== 0) return false;

  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const unpaddedLength = base64.length - padding;
  for (let index = 0; index < unpaddedLength; index += 1) {
    if (valueOf(base64[index]) === -1) return false;
  }
  for (let index = unpaddedLength; index < base64.length; index += 1) {
    if (base64[index] !== '=') return false;
  }
  return true;
}

/**
 * 実行環境固有 API に依存せず、RFC 4648 の標準 Base64 へエンコードします。
 *
 * @param bytes - エンコードするバイト列
 * @returns パディングを含む標準 Base64 文字列
 */
export function toBase64(bytes: Uint8Array): string {
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];

    result += BASE64_ALPHABET[first >> 2];
    result += BASE64_ALPHABET[((first & 0x03) << 4) | ((second ?? 0) >> 4)];
    result += second === undefined ? '=' : BASE64_ALPHABET[((second & 0x0f) << 2) | ((third ?? 0) >> 6)];
    result += third === undefined ? '=' : BASE64_ALPHABET[third & 0x3f];
  }
  return result;
}

/**
 * 正規形式の RFC 4648 Base64 をデコードします。
 * 空白、URL-safe Base64、不正なパディング、非正規なパディングビットは拒否します。
 *
 * @param base64 - デコードする標準 Base64 文字列
 * @returns デコードしたバイト列
 * @throws {Error} 正規形式の Base64 ではない場合
 */
export function fromBase64(base64: string): Uint8Array {
  if (typeof base64 !== 'string' || !hasValidBase64Shape(base64)) {
    throw new Error('Invalid base64');
  }

  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const output = new Uint8Array((base64.length / 4) * 3 - padding);
  let outputIndex = 0;

  for (let index = 0; index < base64.length; index += 4) {
    const first = valueOf(base64[index]);
    const second = valueOf(base64[index + 1]);
    const third = base64[index + 2] === '=' ? 0 : valueOf(base64[index + 2]);
    const fourth = base64[index + 3] === '=' ? 0 : valueOf(base64[index + 3]);

    output[outputIndex++] = (first << 2) | (second >> 4);
    if (outputIndex < output.length) output[outputIndex++] = ((second & 0x0f) << 4) | (third >> 2);
    if (outputIndex < output.length) output[outputIndex++] = ((third & 0x03) << 6) | fourth;
  }

  // Reject non-canonical encodings whose unused padding bits are non-zero.
  if (toBase64(output) !== base64) throw new Error('Invalid base64');
  return output;
}
