# @nemnesia/symbol-harvesters

Symbol の `harvesters.dat` を暗号化・復号する TypeScript / ESM ライブラリです。Shoestring の `import-harvesters` と同じ保存形式を扱います。Node.js 20.19 以降が必要です。通常版の `symbol-sdk` に依存します。

```sh
npm install @nemnesia/symbol-harvesters
```

## 使い方

```ts
import { decryptHarvesters, encryptHarvesters } from '@nemnesia/symbol-harvesters';

import { readFile, writeFile } from 'node:fs/promises';

// 元のノードの暗号化用秘密鍵と、移行先ノードの公開鍵を環境変数から取得します。
const sourcePrivateKey = process.env.SOURCE_NODE_PRIVATE_KEY!;
const destinationPublicKey = process.env.DESTINATION_NODE_PUBLIC_KEY!;

const encrypted = await readFile('harvesters.dat');
const harvesters = await decryptHarvesters(encrypted, sourcePrivateKey);
try {
  const migrated = await encryptHarvesters(harvesters, destinationPublicKey);
  // 元ファイルを上書きせず、所有者だけが読み書きできる新規ファイルに保存します。
  await writeFile('harvesters.migrated.dat', migrated, { mode: 0o600, flag: 'wx' });
} finally {
  for (const harvester of harvesters) {
    harvester.signingPrivateKey.fill(0);
    harvester.vrfPrivateKey.fill(0);
  }
}
```

秘密鍵はノードの暗号化用鍵を指定します。署名用・VRF用の秘密鍵やパスワードで代用できません。ライブラリ API はファイル操作を行いません。

## CLI

パッケージには `symbol-harvesters` コマンドを同梱しています。

```sh
npm install -g @nemnesia/symbol-harvesters
symbol-harvesters --help
```

各コマンドの引数は `symbol-harvesters encrypt --help`、`decrypt --help`、`discover --help`、`restore --help` で確認できます。

復号には元のノード証明書の秘密鍵 PEM ファイルを使用します。

```sh
symbol-harvesters decrypt \
  --input harvesters.dat \
  --output harvesters.json \
  --key-file node.key.pem
```

JSON を暗号化する場合も、宛先ノード証明書の秘密鍵 PEM ファイルを指定します。CLI が対応する公開鍵を導出して暗号化します。復号して得た JSON を別ノードの秘密鍵 PEM で再暗号化すれば鍵の移行ができます。

```sh
symbol-harvesters encrypt \
  --input harvesters.json \
  --output harvesters.migrated.dat \
  --key-file destination-node.key.pem
```

暗号化・復号とも `--key-file` はノード証明書の秘密鍵 PEM を受け付けます。形式は暗号化されていない Ed25519 PKCS#8（`BEGIN PRIVATE KEY`）です。復号には `harvesters.dat` の暗号化に使われた公開鍵と対になる秘密鍵を指定してください。

CLI は公開鍵ファイル、16進数の鍵ファイル、証明書本体（`.crt`）を受け付けません。秘密鍵そのものをコマンド引数へ指定するオプションはありません。

JSON の入出力形式は次の配列です。以下は説明用の架空の鍵です。鍵はそれぞれ64文字の16進数で指定し、復号結果は大文字で出力します。

```json
[
  {
    "signingPrivateKey": "0202020202020202020202020202020202020202020202020202020202020202",
    "vrfPrivateKey": "0303030303030303030303030303030303030303030303030303030303030303"
  }
]
```

出力は権限 `0600` で新規作成し、既存ファイルやシンボリックリンクを上書きしません。全件の変換が成功するまで出力ファイルを作成しません。成功時の終了コードは `0`、引数・入出力・暗号処理の失敗時は `1` です。標準出力に秘密鍵や JSON は出しません。

復号した JSON は秘密鍵を含む平文です。必要な作業後に呼び出し側で管理・削除してください。ファイル権限の扱いは OS に依存し、`0600` による制限は POSIX 環境を対象とします。暗号化された秘密鍵 PEM は受け付けません。

## リンク中のアカウントと委任開始メッセージの探索

`discover` は指定ノードのアドレスに関連する取引から、委任元のアカウントを探索します。現在も同じノードキーへリンクしているアカウントだけを結果に含め、残高、最新のリンク設定ブロック高、リンク設定後の委任開始メッセージを取得します。

```sh
symbol-harvesters discover \
  --key-file node.key.pem \
  --rest-url https://full-rest.example:3001 \
  --cache-file ./discovery-cache.json \
  --output linked-accounts.json
```

`discover` の `--output` は、アドレスと XYM 残高だけの JSON 配列です。

```json
[
  {
    "address": "TADP6C2GVEG654OP5LZI32P2GYJSCMEGQBYB7QY",
    "xym": "12345.678900"
  }
]
```

`xym` は小数6桁の文字列です。浮動小数を使わず最小単位から変換し、XYM 未保有の場合は `"0.000000"` を返します。対象の通貨モザイクIDは `/network/properties`、小数桁数は `/mosaics/{id}` で確認します。確認できない場合は出力せずエラーにします。

復元には `--cache-file` の探索キャッシュを使用します。出力 JSON に公開鍵や暗号化メッセージを含める必要はありません。ライブラリ API の `discoverLinkedAccounts` は引き続き詳細な探索結果を返します。

`--rest-url` は全履歴を保持するフル REST を指定します。省略時は `http://localhost:3000` を使用します。リモートノードにも秘密鍵は送信しません。ネットワークは `/node/info` の識別子から Mainnet / Testnet を区別します。

探索は次の順序で進みます。

1. `/transactions/confirmed?address=<ノードアドレス>` で関連する確定済み取引を100件ずつ取得します。再開・差分取得のため古い順（`order=asc`）に読みます。取引種別は絞らず、`embedded` は指定しません。Aggregate Complete / Bonded はハッシュで詳細を取得し、内部の取引も確認します。
2. 指定ノードへの NodeKeyLink のリンク設定、またはノードアドレス宛てで認証・復号できる委任開始 Transfer の署名者を候補にします。全ネットワークの NodeKeyLink を走査する処理は行いません。
3. `/accounts/{address}` の現在の `supplementalPublicKeys.node.publicKey` を照合します。解除済み、他ノードへ移行済み、存在しないアカウントは結果から除外します。現在リンク中の候補についてだけ、`signerPublicKey` で NodeKeyLink 履歴を絞り込み、最新のリンク設定位置を確認します。リンク履歴が確認できない候補は結果に含めません。
4. リンク中のアカウントの残高をモザイクIDごとの最小単位の10進整数文字列で返します。残高と現在のリンク状態は毎回再取得します。
5. 候補の署名者・ノードの宛先アドレス・リンク設定高さで Transfer（`type=16724`）を絞り込み、委任開始マーカーを持ち、ノード秘密鍵で認証・復号できたメッセージを取得します。ノード公開鍵から導出したアドレスを直接宛先に指定した Transfer が対象です。同じブロックでは取引順序を比較し、Aggregate 内部では親取引の位置と内部 index を使ってリンク設定より後のメッセージだけを採用します。

探索対象はノードアドレスの関連取引として REST が返す範囲です。関連取引に現れない単独の NodeKeyLink だけを送信し、ノード宛ての復号可能な委任開始メッセージもないアカウントは探索できません。

進捗は標準エラーへ表示します。ページ取得開始時に検索する高さ範囲、保存完了時に取得件数・最後に取得した取引の高さ・候補数を表示し、Aggregate の詳細取得とアカウントのリンク・残高確認では処理中の件数を通知します。検索範囲の上限は処理済み高さを示しません。

ライブラリ API が返す `accounts` の主な項目は次のとおりです。

| 項目                   | 内容                                                                     |
| ---------------------- | ------------------------------------------------------------------------ |
| `address`, `publicKey` | 現在もノードキーとリンクしている署名者アカウント                         |
| `linkedHeight`         | 探索済み範囲における最新のリンク設定ブロック高。解除取引では更新しません |
| `balances`             | `{ mosaicId, amount }` の配列。XYM を含む全保有モザイクを返します        |
| `delegationMessages`   | リンク設定後の、復号可能な委任開始メッセージの配列                       |

各メッセージは `id`、`height`、`blockIndex`、`innerIndex`、`message` を持ちます。`message` は委任開始マーカーを含む暗号文の16進文字列で、平文の秘密鍵は含みません。`innerIndex` は単独取引の場合 `-1` です。REST の `id` は接続先DB内の識別子で、ブロック内の位置はネットワーク上の取引順序を表します。

### 探索キャッシュと再開

`--cache-file` の省略時は `.symbol-harvesters-cache/` にネットワークの生成ハッシュとノード公開鍵別のキャッシュを作成します。ノードアドレスの関連取引、候補別の NodeKeyLink 履歴とメッセージ履歴を、検証が完了したページごとに保存します。再実行では途中の次ページから、完了済みの範囲については次の高さから探索します。再リンクを見つけた場合、その新しいリンクより前のメッセージは対象から外します。

キャッシュ形式は version 2 です。旧形式（version 1）のキャッシュで `discover` を実行すると、ネットワークと鍵を検証してから、関連取引のページ1・高さ1から再探索します。旧形式のページ番号は引き継ぎません。残高判定情報のない旧キャッシュは、`discover` で更新するか、`restore --check-balances` で現在の残高を確認してください。

上限は開始時の最終確定高さに固定します。最終確定前の取引は次回以降、確定してから取得します。ページ番号と並び順、ネットワーク・鍵・ブロックハッシュを検証し、不整合があれば停止します。REST の変更時はDB内のページ順序の違いを避けるため、未完了範囲だけをページ1から走査し直します。

キャッシュは一時ファイルから置換し、同じキャッシュへの同時探索を拒否します。強制終了で `.lock` が残った場合は、同じキャッシュを使う処理が停止していることを確認してからその `.lock` を削除してください。既存の結果JSONは上書きしないため、再実行時は新しい `--output` を指定するか、不要になった結果ファイルを削除してください。

キャッシュには公開鍵、取引位置、暗号化メッセージ、探索進捗、最後に確認した有効なリンク情報、通貨モザイクID、小数桁数、XYM残高（最小単位）を保存します。ノード秘密鍵や復号した秘密鍵は保存しません。キャッシュの保管先と内容は利用者が管理してください。

### キャッシュから平文の鍵JSONを復元する

```sh
symbol-harvesters restore \
  --key-file node.key.pem \
  --cache-file ./discovery-cache.json \
  --output harvesters.restored.json

symbol-harvesters encrypt \
  --key-file node.key.pem \
  --input harvesters.restored.json \
  --output harvesters.restored.dat
```

`restore` は通常 REST に接続せず、最後に探索が完了したキャッシュを使用します。キャッシュ確認時の XYM 残高が **10,000 XYM 以上**で、リンク中のアカウントだけを対象にします。10,000 XYM ちょうども含みます。新しい委任開始メッセージから順に復号し、署名用・VRF用公開鍵が最後の探索で取得したリンク情報と両方一致する鍵を復元します。解除済みアカウント、公開鍵が一致しないメッセージは採用しません。

出力は `decrypt` と同じ `{ signingPrivateKey, vrfPrivateKey }` のJSON配列です。そのまま `encrypt` へ渡せます。復元できないアカウントがある場合は復元できた分だけを出力し、標準エラーへ復元件数・復元不可件数とキャッシュの確認日時を通知します。探索途中のキャッシュや別ノードの秘密鍵は拒否します。10,000 XYM 未満は残高条件による除外件数として通知します。残高判定情報のない旧キャッシュは、先に `discover` を再実行するか、次の `--check-balances` を使用してください。

`--check-balances` を付けると、キャッシュ上でリンク中だったアカウントの現在のリンク・XYM 残高・署名用鍵・VRF鍵を REST で再確認してから復元します。

```sh
symbol-harvesters restore \
  --key-file node.key.pem \
  --cache-file ./discovery-cache.json \
  --output harvesters.checked.json \
  --check-balances \
  --rest-url https://full-rest.example:3001
```

`--rest-url` の省略時は `http://localhost:3000` を使用します。`restore` の `--rest-url` は `--check-balances` と併用してください。接続先のネットワーク識別子と生成ハッシュをキャッシュと照合し、現在の残高が10,000 XYM以上のアカウントだけを復元します。解除済み・他ノードへ移行済み・存在しないアカウントはリンク対象外として除外し、復元する鍵は現在の署名用・VRF用公開鍵と照合します。REST 障害や不正な応答では復元を中止し、キャッシュの古い残高へ切り替えません。

再確認では取引履歴を再探索せず、キャッシュのリンク中アカウントと暗号化メッセージを使います。新たな委任アカウントやメッセージの取得には `discover` を再実行してください。再確認結果は今回の復元にだけ使い、キャッシュには書き戻しません。標準エラーに表示する確認日時は、再確認を指定した場合は REST 確認日時、それ以外はキャッシュ確認日時です。

探索はフルRESTの履歴と現在のアカウント応答を根拠にします。履歴を削除したRESTが取引を返さない場合、その欠落を完全には検出できません。また、現在のリンク・残高はアカウントごとに取得するため、単一ブロック時点のスナップショットではありません。`--check-balances` を省略した `restore` はキャッシュ確認時のリンク状態と XYM 残高を使用します。キャッシュ自体を最新状態へ更新するには `discover` を再実行してください。

委任開始リクエストはノードに受理されたことや、現在ハーベスト可能であることを保証しません。残高・インポータンス・ノードの受入枠などによる実際の稼働状態や、ノードが保持する元の `harvesters.dat` との完全一致は検証しません。復元するのは条件を満たすリクエストから得られた鍵です。

## API

| API                                            | 入力                                                              | 戻り値                              |
| ---------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------- |
| `encryptHarvesters(harvesters, nodePublicKey)` | `{ signingPrivateKey, vrfPrivateKey }` の配列、宛先ノードの公開鍵 | `Promise<Uint8Array>`               |
| `decryptHarvesters(data, nodePrivateKey)`      | 暗号化済みバイト列、元ノードの秘密鍵                              | `Promise<DecryptedHarvesterKeys[]>` |
| `HARVESTER_RECORD_SIZE`                        | —                                                                 | `124`                               |

鍵の入力は32バイトの `Uint8Array`（`Buffer` を含む）または64文字の16進文字列です。復号結果の各鍵は32バイトの独立した `Uint8Array` です。空配列は空ファイルに対応します。

探索には `discoverLinkedAccounts({ nodePrivateKey, restUrl?, cacheFile?, onProgress? })`、キャッシュからの復元には `restoreHarvestersFromCache({ nodePrivateKey, cacheFile, checkBalances?, restUrl? })` を使用します。これらの `nodePrivateKey` は32バイトの `Uint8Array` で指定します。PEM の読み込みは CLI が担当します。

`discoverLinkedAccounts` は通貨モザイクIDの `currencyMosaicId` を含む `LinkedAccountsResult` を返します。`restoreHarvestersFromCache` は `{ harvesters, skippedAccounts, checkedAt }` を返し、`skippedAccounts` の理由は `missing-harvesting-keys`（署名用・VRF用のリンク情報不足）、`no-matching-message`（一致するメッセージなし）、`below-minimum-balance`（10,000 XYM 未満）、`not-linked`（再確認時にリンク対象外）です。`restUrl` は `checkBalances: true` と併用します。復元した `harvesters` の各秘密鍵は呼び出し側が使用後に消去してください。

不正な鍵の形式、不完全なレコードは `TypeError`、復号時の不正な公開鍵や認証失敗は `Error` として拒否します。1件でも復号に失敗した場合は結果を返しません。レコードごとに認証する形式のため、レコード単位の削除・並べ替えは検出できません。

復号結果には秘密鍵が含まれます。ログへ出力せず、使用後はバイト配列を消去してください。JavaScript と SDK の内部コピーや文字列を含め、メモリ上の秘密情報を完全に消去する保証はありません。

## 互換性の根拠

対象は Symbol の保存形式です。NEM の形式ではありません。この API はアドレスや署名を生成せず、Mainnet / Testnet を示すフィールドも保存形式にありません。ネットワークに対応するノードの鍵を呼び出し側で選択してください。

| オフセット | 長さ | 内容                                              |
| ---------- | ---- | ------------------------------------------------- |
| 0          | 32   | 一時公開鍵                                        |
| 32         | 16   | AES-GCM 認証タグ                                  |
| 48         | 12   | IV                                                |
| 60         | 64   | 暗号文（署名用秘密鍵32バイト、VRF秘密鍵32バイト） |

レコードはヘッダーなしで連結されます。各レコードで一時鍵と IV を新規生成し、SDK の `SymbolFacade.deriveSharedKey` による Symbol の共有鍵導出と Web Crypto の AES-256-GCM を使用します。

これは Shoestring / Catapult の実装固有の保存形式を根拠にした独立実装です。プロトコル規範仕様や Catbuffer スキーマとして扱いません。

- [Shoestring import_harvesters.py（確認したコミット固定）](https://github.com/symbol/product/blob/9a3f1bf92ff6009b364bda6107af0ccfca9b08ce/tools/shoestring/shoestring/commands/import_harvesters.py)
- [Shoestring の公式テスト](https://github.com/symbol/product/blob/9a3f1bf92ff6009b364bda6107af0ccfca9b08ce/tools/shoestring/tests/commands/test_import_harvesters.py)
- [通常版 Symbol SDK](https://www.npmjs.com/package/symbol-sdk)
- [REST仕様の NodeKeyLink DTO](https://github.com/symbol/symbol/blob/14a0cc16ef277875fb9af71b3a0d03b80f27283e/openapi/spec/plugins/account_link/schemas/NodeKeyLinkTransactionBodyDTO.yml)
- [Aggregate内部取引の位置を保存する公式Mongo実装](https://github.com/symbol/symbol/blob/14a0cc16ef277875fb9af71b3a0d03b80f27283e/client/catapult/extensions/mongo/plugins/aggregate/src/AggregateMapper.cpp)
- [公式Catapultの委任アカウント検証](https://github.com/symbol/symbol/blob/14a0cc16ef277875fb9af71b3a0d03b80f27283e/client/catapult/extensions/harvesting/src/UnlockedAccountsUpdater.cpp)

探索のRESTフィールドと取引型はREST仕様、委任メッセージの判定と復号はSDKの利便API、署名用・VRF用・ノード公開鍵の照合はCatapult実装を根拠にします。キャッシュ、ページ再開、CLIの入出力はこのパッケージ固有の設計判断です。

テストでは公式 Shoestring の fixture から4件の Testnet アドレスを確認し、通常版 SDK の委任メッセージ形式との相互変換、鍵の移行、改ざんや鍵違いの拒否を検証します。稼働中ノードへの投入は検証対象に含みません。

## 開発

リポジトリのルートで依存関係をインストールして実行します。

```sh
pnpm --filter @nemnesia/symbol-harvesters typecheck
pnpm --filter @nemnesia/symbol-harvesters lint
pnpm --filter @nemnesia/symbol-harvesters test
pnpm --filter @nemnesia/symbol-harvesters build
pnpm --filter @nemnesia/symbol-harvesters pack --pack-destination /tmp
```

MIT License。公式 fixture の出典とライセンス情報は [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) を参照してください。
