#!/usr/bin/env node
import { Command, CommanderError } from 'commander';

import { createPrivateKey, createPublicKey } from 'node:crypto';
import { open, readFile, unlink } from 'node:fs/promises';

import { DiagnosticError, fileErrorDetail } from './errors.js';
import {
  type DecryptedHarvesterKeys,
  HARVESTER_RECORD_SIZE,
  type HarvesterKeys,
  type LinkedAccountsResult,
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
  } catch {
    throw new DiagnosticError(
      '--key-file の形式が不正です。暗号化されていないEd25519 PKCS#8の秘密鍵PEMを指定してください。'
    );
  } finally {
    contents.fill(0);
  }
}

/** JSONの構造を検証してから暗号化APIへ渡します。 */
function parseHarvesters(contents: Buffer): HarvesterKeys[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents.toString('utf8'));
  } catch {
    throw new DiagnosticError('--input のJSON構文が不正です。');
  }
  if (!Array.isArray(parsed)) throw new DiagnosticError('--input はハーベスターのJSON配列で指定してください。');
  return parsed.map((entry: unknown, index: number) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry))
      throw new DiagnosticError(`--input の${index + 1}件目は鍵のオブジェクトで指定してください。`);
    const record = entry as Record<string, unknown>;
    for (const field of ['signingPrivateKey', 'vrfPrivateKey'] as const) {
      if (typeof record[field] !== 'string' || !/^[a-fA-F0-9]{64}$/.test(record[field]))
        throw new DiagnosticError(`--input の${index + 1}件目の ${field} は64文字の16進文字列で指定してください。`);
    }
    return { signingPrivateKey: record.signingPrivateKey as string, vrfPrivateKey: record.vrfPrivateKey as string };
  });
}

/** 探索結果をアドレスと正確なXYM数量に整えます。 */
function discoverySummary(discovered: LinkedAccountsResult) {
  return discovered.accounts.map(({ address, balances }) => {
    const amount = BigInt(balances.find((balance) => balance.mosaicId === discovered.currencyMosaicId)?.amount ?? '0');
    return { address, xym: `${amount / 1_000_000n}.${(amount % 1_000_000n).toString().padStart(6, '0')}` };
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
  let stage = 'ノード秘密鍵の読み込み（--key-file）';
  let hint = '鍵ファイルとアクセス権を確認してください。';
  try {
    nodeKey = await readNodeKey(keyFile, command);
    if (command === 'discover') {
      stage = '委任アカウントの探索';
      hint = 'RESTの接続先・応答、探索キャッシュを確認してください。';
      const discovered = await discoverLinkedAccounts({
        nodePrivateKey: nodeKey,
        restUrl: options.restUrl,
        cacheFile: options.cacheFile,
        onProgress: ({
          phase,
          status,
          pageNumber,
          fromHeight,
          toHeight,
          candidateCount,
          transactionCount,
          lastHeight,
          accountNumber,
          accountCount,
          aggregateNumber,
          aggregateCount,
        }) => {
          if (phase === 'accounts') {
            process.stderr.write(`リンク・残高確認: ${accountNumber}/${accountCount}件。\n`);
            return;
          }
          const label =
            phase === 'transactions' ? 'ノード関連取引' : phase === 'links' ? '候補のリンク履歴' : '委任メッセージ';
          if (status === 'aggregate') {
            process.stderr.write(
              `${label}: ページ${pageNumber}のAggregate詳細を取得中（${aggregateNumber}/${aggregateCount}件）。\n`
            );
          } else if (status === 'request') {
            process.stderr.write(`${label}: ページ${pageNumber}取得中（検索範囲${fromHeight}〜${toHeight}）。\n`);
          } else {
            process.stderr.write(
              `${label}: ページ${pageNumber}の${transactionCount}件を保存（取得した最終高さ${lastHeight ?? '該当なし'}、候補${candidateCount}件）。\n`
            );
          }
        },
      });
      stage = '探索結果のXYM残高表示';
      result = Buffer.from(JSON.stringify(discoverySummary(discovered), null, 2) + '\n');
    } else if (command === 'encrypt') {
      stage = '入力ファイルの読み込み（--input）';
      hint = '入力ファイルとアクセス権を確認してください。';
      contents = await readFile(input!);
      stage = '入力JSONの検証・暗号化';
      hint = '入力の鍵形式とノード鍵を確認してください。';
      result = await encryptHarvesters(parseHarvesters(contents), nodeKey);
    } else {
      if (command === 'restore') {
        stage = 'キャッシュからの復元（--cache-file）';
        hint = '探索済みキャッシュとノード鍵を確認してください。';
        const restored = await restoreHarvestersFromCache({
          nodePrivateKey: nodeKey,
          cacheFile: options.cacheFile!,
        });
        decrypted = restored.harvesters;
        const excludedCount = restored.skippedAccounts.filter(
          (account) => account.reason === 'below-minimum-balance'
        ).length;
        process.stderr.write(
          `キャッシュ確認日時: ${restored.checkedAt}。復元${decrypted.length}件、残高条件による除外${excludedCount}件、復元不可${restored.skippedAccounts.length - excludedCount}件。\n`
        );
      } else {
        stage = '入力ファイルの読み込み（--input）';
        hint = '入力ファイルとアクセス権を確認してください。';
        contents = await readFile(input!);
        stage = 'harvesters.datの復号';
        if (contents.length % HARVESTER_RECORD_SIZE !== 0)
          throw new DiagnosticError(
            `--input のサイズが不正です。${HARVESTER_RECORD_SIZE}バイト単位の完全なレコードが必要です。`
          );
        hint = 'レコードが不正、またはノード秘密鍵が一致しません。鍵の不一致とデータの破損・改ざんは区別できません。';
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
    stage = '出力ファイルの保存（--output）';
    hint = '出力先とアクセス権を確認してください。';
    await writeOutput(output, result);
  } catch (error) {
    const detail = error instanceof DiagnosticError ? error.message : (fileErrorDetail(error) ?? hint);
    // 外部例外のcauseにも秘密情報が含まれ得るため、安全な診断だけを伝播します。
    throw new DiagnosticError(`${stage}に失敗しました。${detail}`);
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
  command('discover', '現在もノードキーがリンクしているアカウントのアドレス・XYM残高を保存します。')
    .option('--rest-url <url>', '探索に使用するフルRESTのURL。', 'http://localhost:3000')
    .option(
      '--cache-file <path>',
      '探索キャッシュ（省略時は.symbol-harvesters-cache配下にネットワーク・鍵ごとに保存）。'
    );
  command('restore', '完了済みキャッシュで10,000 XYM以上のアカウントから、平文の鍵JSONを復元します。').requiredOption(
    '--cache-file <path>',
    '探索が完了したキャッシュファイル。'
  );

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
