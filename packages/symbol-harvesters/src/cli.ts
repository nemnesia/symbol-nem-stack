#!/usr/bin/env node
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { open, readFile, unlink } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { type DecryptedHarvesterKeys, type HarvesterKeys, decryptHarvesters, encryptHarvesters } from './index.js';

const help = `使い方:
  symbol-harvesters encrypt --input harvesters.json --output harvesters.dat --key-file node.key.pem
  symbol-harvesters decrypt --input harvesters.dat --output harvesters.json --key-file node.key.pem

コマンド:
  encrypt    署名用・VRF用秘密鍵のJSON配列を暗号化します。
  decrypt    harvesters.datを復号して秘密鍵のJSON配列を保存します。

オプション:
  --input     入力ファイル
  --output    新規出力ファイル（既存ファイルの上書きはしません）
  --key-file  ノード証明書の秘密鍵（暗号化されていないEd25519 PKCS#8 PEM）
              encryptでは秘密鍵から公開鍵を導出して使用します。
  -h, --help  ヘルプを表示します。

JSON形式: [{"signingPrivateKey":"64文字の16進数","vrfPrivateKey":"64文字の16進数"}]
復号結果は秘密鍵を含みます。出力ファイルは権限0600で新規作成します。
`;

/** ノード証明書の秘密鍵PEMを読み込み、暗号化時は対応する公開鍵を導出します。 */
async function readNodeKey(path: string, command: string): Promise<Uint8Array> {
  const contents = await readFile(path);
  try {
    const text = contents.toString('utf8').trim();
    if (!text.startsWith('-----BEGIN PRIVATE KEY-----')) throw new Error();
    const privateKey = createPrivateKey(contents);
    if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error();
    const key = command === 'encrypt' ? createPublicKey(privateKey) : privateKey;
    const jwk = key.export({ format: 'jwk' });
    const encoded = command === 'encrypt' ? jwk.x : jwk.d;
    if (!encoded) throw new Error();
    const bytes = Buffer.from(encoded, 'base64url');
    if (bytes.length !== 32) throw new Error();
    return bytes;
  } finally {
    contents.fill(0);
  }
}

/** JSONの構造を検証してから暗号化APIへ渡します。 */
function parseHarvesters(contents: Buffer): HarvesterKeys[] {
  const parsed: unknown = JSON.parse(contents.toString('utf8'));
  if (!Array.isArray(parsed)) throw new Error();
  return parsed.map((entry: unknown) => {
    if (entry === null || typeof entry !== 'object') throw new Error();
    const { signingPrivateKey, vrfPrivateKey } = entry as Record<string, unknown>;
    if (
      typeof signingPrivateKey !== 'string' ||
      typeof vrfPrivateKey !== 'string' ||
      !/^[a-fA-F0-9]{64}$/.test(signingPrivateKey) ||
      !/^[a-fA-F0-9]{64}$/.test(vrfPrivateKey)
    ) {
      throw new Error();
    }
    return { signingPrivateKey, vrfPrivateKey };
  });
}

/** 変換が成功してから排他的に出力を作成し、書き込み失敗時の部分ファイルを削除します。 */
async function writeOutput(path: string, contents: Uint8Array): Promise<void> {
  const file = await open(path, 'wx', 0o600);
  try {
    await file.writeFile(contents);
  } catch (error) {
    await file.close();
    await unlink(path);
    throw error;
  }
  await file.close();
}

/** 引数や下位例外に含まれる秘密情報を表示せず、処理結果だけを通知します。 */
async function main(): Promise<void> {
  let args;
  try {
    args = parseArgs({
      options: {
        input: { type: 'string' },
        output: { type: 'string' },
        'key-file': { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch {
    throw new Error('引数が不正です。--helpで使い方を確認してください。');
  }
  if (args.values.help) {
    process.stdout.write(help);
    return;
  }
  const [command] = args.positionals;
  const { input, output, 'key-file': keyFile } = args.values;
  if (args.positionals.length !== 1 || !['encrypt', 'decrypt'].includes(command) || !input || !output || !keyFile) {
    throw new Error('コマンドと--input、--output、--key-fileを指定してください。--helpで使い方を確認できます。');
  }

  let nodeKey: Uint8Array | undefined;
  let contents: Buffer | undefined;
  let result: Uint8Array | undefined;
  let decrypted: DecryptedHarvesterKeys[] = [];
  try {
    nodeKey = await readNodeKey(keyFile, command);
    contents = await readFile(input);
    if (command === 'encrypt') {
      result = await encryptHarvesters(parseHarvesters(contents), nodeKey);
    } else {
      decrypted = await decryptHarvesters(contents, nodeKey);
      result = Buffer.from(
        JSON.stringify(
          decrypted.map((entry) => ({
            signingPrivateKey: Buffer.from(entry.signingPrivateKey).toString('hex').toUpperCase(),
            vrfPrivateKey: Buffer.from(entry.vrfPrivateKey).toString('hex').toUpperCase(),
          })),
          null,
          2
        ) + '\n'
      );
    }
    await writeOutput(output, result);
  } catch {
    throw new Error('処理に失敗しました。入力・鍵の形式、復号鍵、出力先の存在とアクセス権を確認してください。');
  } finally {
    nodeKey?.fill(0);
    contents?.fill(0);
    result?.fill(0);
    for (const entry of decrypted) {
      entry.signingPrivateKey.fill(0);
      entry.vrfPrivateKey.fill(0);
    }
  }
  process.stdout.write('完了しました。\n');
}

main().catch((error: Error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
