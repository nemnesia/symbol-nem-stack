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

復号した JSON は秘密鍵を含む平文です。必要な作業後に呼び出し側で管理・削除してください。ファイル権限の扱いは OS に依存し、`0600` による制限は POSIX 環境を対象とします。暗号化された秘密鍵 PEM、アドレス一覧表示は提供しません。

## API

| API                                            | 入力                                                              | 戻り値                              |
| ---------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------- |
| `encryptHarvesters(harvesters, nodePublicKey)` | `{ signingPrivateKey, vrfPrivateKey }` の配列、宛先ノードの公開鍵 | `Promise<Uint8Array>`               |
| `decryptHarvesters(data, nodePrivateKey)`      | 暗号化済みバイト列、元ノードの秘密鍵                              | `Promise<DecryptedHarvesterKeys[]>` |
| `HARVESTER_RECORD_SIZE`                        | —                                                                 | `124`                               |

鍵の入力は32バイトの `Uint8Array`（`Buffer` を含む）または64文字の16進文字列です。復号結果の各鍵は32バイトの独立した `Uint8Array` です。空配列は空ファイルに対応します。

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
