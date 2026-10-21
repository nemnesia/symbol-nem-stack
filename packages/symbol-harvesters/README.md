# @nemnesia/symbol-harvesters

Symbol の `harvesters.dat` を暗号化・復号し、委任開始メッセージからハーベスターの鍵を復元する CLI / TypeScript ライブラリです。Shoestring の `import-harvesters` と互換性のある保存形式を扱います。

- ノードにリンクしているアカウントを探索し、アドレスと XYM 残高を出力します。
- 探索キャッシュから、10,000 XYM 以上のアカウントの署名用・VRF用秘密鍵を復元します。
- 秘密鍵の JSON と `harvesters.dat` を相互変換し、別ノードの鍵で再暗号化できます。

対象は Symbol Mainnet / Testnet です。NEM の保存形式は対象外です。Node.js **20.19.0 以降**が必要です。

## インストール

CLI をインストールする場合:

```sh
npm install -g @nemnesia/symbol-harvesters
symbol-harvesters --help
```

インストールせずに実行する場合:

```sh
npx --package @nemnesia/symbol-harvesters symbol-harvesters --help
```

ライブラリとして使う場合:

```sh
npm install @nemnesia/symbol-harvesters
```

ESM 形式で提供し、`symbol-sdk` に依存します。

## コマンド

| コマンド   | 用途                                                    | 出力ファイル                    |
| ---------- | ------------------------------------------------------- | ------------------------------- |
| `discover` | ノードへの委任を探索し、復元用キャッシュを作成・更新    | アドレスと XYM 残高の JSON      |
| `restore`  | 完了済みキャッシュから、10,000 XYM 以上の対象の鍵を復元 | 平文の秘密鍵 JSON               |
| `decrypt`  | `harvesters.dat` を復号                                 | 平文の秘密鍵 JSON               |
| `encrypt`  | 平文の秘密鍵 JSON を暗号化                              | `harvesters.dat` 形式のバイナリ |

全コマンドで `--key-file` と `--output` が必要です。`--help` / `-h` はヘルプを表示して終了します。

```sh
symbol-harvesters discover --help
symbol-harvesters restore --help
symbol-harvesters decrypt --help
symbol-harvesters encrypt --help
```

### ノードの鍵

`--key-file` には、ノード証明書の**秘密鍵 PEM ファイル**を指定します。形式は暗号化されていない Ed25519 PKCS#8（`-----BEGIN PRIVATE KEY-----`）です。

`discover` / `restore` には委任先ノードの秘密鍵、`decrypt` には元ファイルの暗号化先と対になる秘密鍵、`encrypt` には暗号化先ノードの秘密鍵を指定します。暗号化時は CLI が公開鍵を導出します。

公開鍵ファイル、証明書本体（`.crt`）、16進数だけのファイル、パスワード付き PEM は受け付けません。秘密鍵そのものをコマンド引数に渡すオプションはありません。

## 委任アカウントの探索

```sh
symbol-harvesters discover \
  --key-file node.key.pem \
  --rest-url https://full-rest.example:3001 \
  --cache-file discovery-cache.json \
  --output linked-accounts.json
```

`https://full-rest.example:3001` は説明用の URL です。実際には対象ネットワークの全履歴を保持するフル REST を指定してください。省略時は `http://localhost:3000` を使用します。ネットワークは REST 応答から Mainnet / Testnet を判定し、ノード秘密鍵を通信に含めません。

ノード公開鍵から導出したアドレスを `address` 条件にして関連取引を検索し、Aggregate Complete / Bonded の内部も確認します。見つけた候補のリンク履歴を署名者で絞り込み、現在も同じノードへリンクしているアカウントを結果に含めます。

`--output` の内容は次の JSON 配列です。10,000 XYM 未満のアカウントも表示します。

```json
[
  {
    "address": "TADP6C2GVEG654OP5LZI32P2GYJSCMEGQBYB7QY",
    "xym": "12345.678900"
  }
]
```

`xym` は小数6桁の文字列です。数量は整数で扱い、浮動小数による丸めを行いません。XYM 未保有の場合は `"0.000000"` です。通貨モザイクIDと小数桁数は REST で確認します。

復元に使用するリンク情報と暗号化メッセージは `--cache-file` に保存します。アドレス・残高の出力 JSON と、復元用キャッシュは別のファイルです。

### キャッシュと再開

`--cache-file` を省略すると、次の場所にネットワークとノード公開鍵ごとのキャッシュを作成します。

```text
.symbol-harvesters-cache/<generationHashSeed>-<nodePublicKey>.json
```

検索範囲の上限を開始時の最終確定高さに固定し、古い順に100件ずつ取得します。検証が完了したページごとに進捗を保存し、再実行時は途中の次ページ、または探索済み範囲の次の高さから再開します。残高と現在のリンク状態は毎回再取得します。接続先 REST を変更した場合は、未完了範囲をページ1から読み直します。

進捗は標準エラーへ表示します。ページの取得開始・保存件数・取得した取引の高さ・候補数・Aggregate の詳細取得・アカウント確認の進捗を表示します。検索範囲の上限は処理済み高さを示す値ではありません。

キャッシュには公開鍵、取引位置、暗号化メッセージ、リンク情報、XYM 残高、確認日時、探索進捗を保存します。ノード秘密鍵や復号した秘密鍵は保存しません。キャッシュは利用者が管理し、信頼できるものを使用してください。

同じキャッシュへの同時探索は拒否します。強制終了で `.lock` が残った場合は、同じキャッシュを使う処理が停止していることを確認してから、そのロックファイルを削除してください。

## キャッシュから鍵を復元する

```sh
symbol-harvesters restore \
  --key-file node.key.pem \
  --cache-file discovery-cache.json \
  --output harvesters.restored.json
```

通常は REST に接続せず、完了済みキャッシュの確認時点で次の条件を満たすアカウントの鍵を復元します。

- 指定ノードへのリンクが有効である。
- XYM 残高が **10,000 XYM 以上**である。10,000 XYM ちょうども対象です。
- リンク設定後の委任開始メッセージをノード秘密鍵で復号でき、署名用・VRF用公開鍵がキャッシュのリンク情報と一致する。

新しいメッセージから順に照合し、一致する鍵を復元します。同じ署名用・VRF用鍵の組は重複して出力しません。条件を満たすメッセージがないアカウントは復元不可として報告し、復元できた分を保存します。

標準エラーへ確認日時、復元件数、残高条件による除外件数、リンク対象外件数、復元不可件数を表示します。探索途中のキャッシュや別ノードの秘密鍵は拒否します。

### 現在のリンクと残高を確認して復元する

```sh
symbol-harvesters restore \
  --key-file node.key.pem \
  --cache-file discovery-cache.json \
  --output harvesters.checked.json \
  --check-balances \
  --rest-url https://full-rest.example:3001
```

`--check-balances` は、キャッシュ上でリンク中だったアカウントの現在のリンク・XYM 残高・署名用鍵・VRF鍵を REST で確認します。現在の残高が10,000 XYM以上で、同じノードへリンクし、復元する鍵が現在の署名用・VRF用公開鍵と一致する場合に出力します。

解除済み、他ノードへ移行済み、存在しないアカウントはリンク対象外として除外します。接続先のネットワーク識別子と生成ハッシュをキャッシュと照合し、REST 障害や不正な応答があれば復元を中止します。

`--rest-url` の省略時は `http://localhost:3000` を使用します。`restore` の `--rest-url` は `--check-balances` と併用してください。

再確認は今回の復元にだけ使用し、キャッシュを書き換えません。取引履歴の再探索や新しいアカウントの追加も行いません。キャッシュと委任開始メッセージを更新するには `discover` を再実行してください。残高情報のないキャッシュも、`--check-balances` で現在の残高を取得すれば復元できます。

## harvesters.dat の復号・暗号化

既存ファイルを復号する場合:

```sh
symbol-harvesters decrypt \
  --key-file node.key.pem \
  --input harvesters.dat \
  --output harvesters.json
```

`decrypt` / `restore` の出力と `encrypt` の入力は、同じ形式の平文 JSON 配列です。以下の鍵は説明用の架空の値です。

```json
[
  {
    "signingPrivateKey": "0202020202020202020202020202020202020202020202020202020202020202",
    "vrfPrivateKey": "0303030303030303030303030303030303030303030303030303030303030303"
  }
]
```

各鍵は64文字の16進文字列です。復号・復元した鍵は大文字で出力します。

復元した JSON を `harvesters.dat` 形式へ暗号化する場合:

```sh
symbol-harvesters encrypt \
  --key-file node.key.pem \
  --input harvesters.restored.json \
  --output harvesters.restored.dat
```

`--key-file` に移行先ノードの秘密鍵 PEM を指定すれば、移行先の公開鍵で再暗号化できます。`encrypt` / `decrypt` は入力された鍵やレコードを変換し、10,000 XYM の条件による絞り込みは行いません。空配列は空ファイルに対応します。

## 入出力とエラー

出力は新規ファイルとして権限 `0600` で作成し、既存ファイルやシンボリックリンクを上書きしません。再実行時は別の `--output` を指定してください。出力先の親ディレクトリは事前に作成してください。権限による制限は POSIX 環境を対象とします。

成功時の終了コードは `0`、失敗時は `1` です。標準出力には完了メッセージ、標準エラーには進捗と診断を表示します。秘密鍵や出力 JSON を標準出力に表示しません。

| 診断・状況                                   | 対応                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| `--help` / `-h` でヘルプだけが表示される     | 実行時はヘルプオプションを外す                                             |
| 出力先が既に存在する（`EEXIST`）             | 新しい出力ファイル名を指定する                                             |
| 鍵 PEM の形式が不正                          | 暗号化されていない Ed25519 PKCS#8 秘密鍵を指定する                         |
| 復号に失敗する                               | 元のノード鍵とファイルを確認する。鍵の不一致と破損・改ざんは区別できません |
| キャッシュに残高判定情報がない               | `discover` を再実行するか、`restore --check-balances` で確認する           |
| キャッシュと REST のネットワークが一致しない | 同じ Mainnet / Testnet と生成ハッシュの REST を使用する                    |

**`decrypt` / `restore` の出力 JSON は平文の秘密鍵です。** ログやリポジトリへ含めず、必要な作業後に安全に管理・削除してください。

## ライブラリ API

```ts
import { decryptHarvesters, encryptHarvesters } from '@nemnesia/symbol-harvesters';

import { readFile, writeFile } from 'node:fs/promises';

// 64文字の16進数の鍵を、管理された環境から取得します。
const sourcePrivateKey = process.env.SOURCE_NODE_PRIVATE_KEY!;
const destinationPublicKey = process.env.DESTINATION_NODE_PUBLIC_KEY!;

const harvesters = await decryptHarvesters(await readFile('harvesters.dat'), sourcePrivateKey);
try {
  const migrated = await encryptHarvesters(harvesters, destinationPublicKey);
  await writeFile('harvesters.migrated.dat', migrated, { flag: 'wx', mode: 0o600 });
} finally {
  for (const harvester of harvesters) {
    harvester.signingPrivateKey.fill(0);
    harvester.vrfPrivateKey.fill(0);
  }
}
```

| API                                            | 入力                                                             | 戻り値                              |
| ---------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------- |
| `encryptHarvesters(harvesters, nodePublicKey)` | `{ signingPrivateKey, vrfPrivateKey }` の配列、暗号化先の公開鍵  | `Promise<Uint8Array>`               |
| `decryptHarvesters(data, nodePrivateKey)`      | 暗号化済みバイト列、ノード秘密鍵                                 | `Promise<DecryptedHarvesterKeys[]>` |
| `discoverLinkedAccounts(options)`              | `nodePrivateKey`、任意の `restUrl`・`cacheFile`・`onProgress`    | `Promise<LinkedAccountsResult>`     |
| `restoreHarvestersFromCache(options)`          | `nodePrivateKey`、`cacheFile`、任意の `checkBalances`・`restUrl` | `Promise<RestoreHarvestersResult>`  |
| `HARVESTER_RECORD_SIZE`                        | —                                                                | `124`                               |

暗号化・復号 API の鍵は32バイトの `Uint8Array`（`Buffer` を含む）、または64文字の16進文字列で指定します。探索・復元 API の `nodePrivateKey` は32バイトの `Uint8Array` です。PEM の読み込みは CLI が担当します。

暗号化・復号 API はファイル操作を行いません。探索 API は REST 通信とキャッシュの読み書き、復元 API はキャッシュの読み込みと、`checkBalances: true` の場合に REST 通信を行います。復元 API の `restUrl` は `checkBalances: true` と併用します。

`discoverLinkedAccounts` はネットワーク、生成ハッシュ、ノード公開鍵・アドレス、`currencyMosaicId`、探索済み高さ、候補数、`accounts` を返します。各アカウントには次の情報を含みます。

| 項目                   | 内容                                                               |
| ---------------------- | ------------------------------------------------------------------ |
| `address`, `publicKey` | 現在リンク中のアカウントのアドレス・公開鍵                         |
| `linkedHeight`         | 探索済み範囲の最新のリンク設定高さ                                 |
| `balances`             | `{ mosaicId, amount }` の配列。数量は最小単位の10進整数文字列      |
| `delegationMessages`   | リンク設定後の復号可能な委任開始メッセージ。暗号文と取引位置を含む |

`restoreHarvestersFromCache` は `{ harvesters, skippedAccounts, checkedAt }` を返します。`harvesters` の鍵はそれぞれ独立した32バイトの `Uint8Array` です。`checkedAt` は、通常はキャッシュ確認日時、再確認時は REST 確認日時です。

| `skippedAccounts[].reason` | 理由                                                 |
| -------------------------- | ---------------------------------------------------- |
| `below-minimum-balance`    | 10,000 XYM 未満                                      |
| `not-linked`               | REST 再確認時にリンク対象外                          |
| `missing-harvesting-keys`  | 署名用・VRF用のリンク情報が不足                      |
| `no-matching-message`      | 現在のリンク情報と一致する復元可能なメッセージがない |

復号 API は不正な鍵の形式・不完全なレコードを `TypeError`、不正な公開鍵・認証失敗を `Error` として拒否します。1件でも復号に失敗すると結果を返しません。

復号・復元した鍵のバイト配列は、呼び出し側で使用後に消去してください。JavaScript と SDK の内部コピーや文字列を含め、秘密情報をメモリから完全に消去する保証はありません。

## 対応範囲

探索対象は、指定ノードのアドレスに関連する取引として REST が返す範囲です。関連取引に現れない単独の NodeKeyLink だけを送信し、ノード宛ての復号可能な委任開始メッセージもないアカウントは探索できません。ノード公開鍵から導出したアドレスを直接宛先に指定した委任開始 Transfer を対象とします。

探索履歴は最終確定高さまでを対象とします。リンク・残高の現在値はアカウントごとに取得するため、全アカウントが単一ブロック時点の状態であるとは保証しません。REST が削除済みの履歴を返さない場合、その欠落を完全には検出できません。

復元結果は条件に一致する委任開始メッセージから得た鍵です。ノードによる受理、現在のハーベスト可否、元の `harvesters.dat` との完全一致を保証しません。稼働中ノードへの投入はテスト対象に含みません。

保存形式は Shoestring / Catapult の実装を根拠とするもので、プロトコル規範仕様や Catbuffer スキーマではありません。レコードごとの一時公開鍵・認証タグ・IV・暗号文を124バイトで連結し、Symbol SDK の共有鍵導出と AES-256-GCM を使用します。レコード単位の削除・並べ替えは検出できません。キャッシュ、CLI の入出力、10,000 XYM の復元条件はこのパッケージ固有の動作です。

## 開発

リポジトリのルートで依存関係をインストールしてから実行します。

```sh
pnpm --filter @nemnesia/symbol-harvesters typecheck
pnpm --filter @nemnesia/symbol-harvesters lint
pnpm --filter @nemnesia/symbol-harvesters test
pnpm --filter @nemnesia/symbol-harvesters build
```

## ライセンス

[MIT License](./LICENSE)。公式 Shoestring のテストデータの出典・帰属は [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) を参照してください。
