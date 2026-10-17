#!/usr/bin/env node
import { Command, CommanderError } from 'commander';

import { createPrivateKey, createPublicKey } from 'node:crypto';
import { open, readFile, unlink } from 'node:fs/promises';

import {
  type DecryptedHarvesterKeys,
  type HarvesterKeys,
  decryptHarvesters,
  discoverLinkedAccounts,
  encryptHarvesters,
  restoreHarvestersFromCache,
} from './index.js';

type CommandName = 'encrypt' | 'decrypt' | 'discover' | 'restore';

interface CliOptions {
  input?: string;
  output: string;
  keyFile: string;
  restUrl?: string;
  cacheFile?: string;
}

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

/** 検証済みの引数で処理を実行し、秘密情報を出力せずに後始末します。 */
async function execute(command: CommandName, options: CliOptions): Promise<void> {
  const { input, output, keyFile } = options;
  let nodeKey: Uint8Array | undefined;
  let contents: Buffer | undefined;
  let result: Uint8Array | undefined;
  let decrypted: DecryptedHarvesterKeys[] = [];
  try {
    nodeKey = await readNodeKey(keyFile, command);
    if (command === 'discover') {
      const discovered = await discoverLinkedAccounts({
        nodePrivateKey: nodeKey,
        restUrl: options.restUrl,
        cacheFile: options.cacheFile,
        onProgress: ({ phase, pageNumber, toHeight, candidateCount }) => {
          process.stderr.write(
            `${phase === 'links' ? 'リンク' : 'メッセージ'}探索: 高さ${toHeight}までのページ${pageNumber}を保存しました（候補${candidateCount}件）。\n`
          );
        },
      });
      result = Buffer.from(JSON.stringify(discovered, null, 2) + '\n');
    } else if (command === 'encrypt') {
      contents = await readFile(input!);
      result = await encryptHarvesters(parseHarvesters(contents), nodeKey);
    } else {
      if (command === 'restore') {
        const restored = await restoreHarvestersFromCache({
          nodePrivateKey: nodeKey,
          cacheFile: options.cacheFile!,
        });
        decrypted = restored.harvesters;
        process.stderr.write(
          `キャッシュ確認日時: ${restored.checkedAt}。復元${decrypted.length}件、復元不可${restored.skippedAccounts.length}件。\n`
        );
      } else {
        contents = await readFile(input!);
        decrypted = await decryptHarvesters(contents, nodeKey);
      }
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
    throw new Error(
      '処理に失敗しました。入力・鍵の形式、復号鍵、出力先、RESTの接続先・履歴・キャッシュとアクセス権を確認してください。'
    );
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

/** コマンドごとの引数定義から必須項目の検証とヘルプを生成します。 */
async function main(): Promise<void> {
  const program = new Command()
    .name('symbol-harvesters')
    .description('Symbolのharvesters.datの暗号化・復号と、委任アカウントの探索・復元を行います。')
    .helpOption('-h, --help', 'ヘルプを表示します。')
    .helpCommand(false)
    .showSuggestionAfterError(false)
    .exitOverride()
    .configureOutput({
      // 不正な引数にも秘密鍵が渡される可能性があるため、パーサーの診断は固定文に置き換えます。
      outputError: (_message, write) => write('引数が不正です。--helpで使い方を確認してください。\n'),
    })
    .addHelpText(
      'after',
      '\n全コマンドで --key-file にノード証明書の秘密鍵PEMを指定します。詳細は各コマンドの --help を参照してください。'
    );

  function command(name: CommandName, description: string): Command {
    return program
      .command(name)
      .description(description)
      .helpOption('-h, --help', 'ヘルプを表示します。')
      .allowExcessArguments(false)
      .requiredOption('--output <path>', '新規出力ファイル（既存ファイルは上書きしません）。')
      .requiredOption('--key-file <pem>', 'ノード証明書の秘密鍵（暗号化されていないEd25519 PKCS#8 PEM）。')
      .action((options: CliOptions) => execute(name, options));
  }

  command('encrypt', '署名用・VRF用秘密鍵のJSON配列を暗号化します。秘密鍵PEMから公開鍵を導出します。').requiredOption(
    '--input <path>',
    '署名用・VRF用秘密鍵のJSON配列。'
  );
  command('decrypt', 'harvesters.datを復号して秘密鍵のJSON配列を保存します。').requiredOption(
    '--input <path>',
    '暗号化されたharvesters.dat。'
  );
  command('discover', '現在もノードキーがリンクしているアカウントの残高・リンク高さ・委任開始メッセージを保存します。')
    .option('--rest-url <url>', '探索に使用するフルRESTのURL。', 'http://localhost:3000')
    .option(
      '--cache-file <path>',
      '探索キャッシュ（省略時は.symbol-harvesters-cache配下にネットワーク・鍵ごとに保存）。'
    );
  command(
    'restore',
    '完了済みキャッシュの委任開始メッセージから、harvesters.datと同形式の平文の鍵JSONを復元します。'
  ).requiredOption('--cache-file <path>', '探索が完了したキャッシュファイル。');

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (!(error instanceof CommanderError)) throw error;
    // ヘルプ表示は正常終了、それ以外の引数エラーは終了コード1とします。例外の原文は表示しません。
    if (error.exitCode !== 0) process.exitCode = 1;
  }
}

main().catch((error: Error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
