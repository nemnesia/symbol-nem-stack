# Symbol NEM Interchange Format

Symbol NEM Interchange Format（SNIF）v1 Draft 2のTypeScript実装です。SymbolおよびNEMのデータを、搬送手段に依存しない決定的なバイト列として生成・解析・検証します。

このパッケージは規範fixtureマトリクスが未完成の非公開プレリリースです。仕様書のPhase 3ゲートを満たすまでは公開せず、SNIF適合実装として扱わないでください。

規範仕様は[`doc/spec.md`](doc/spec.md)、実装間で共有するテストベクトルは[`doc/fixtures`](doc/fixtures)を参照してください。READMEと仕様書が競合する場合は仕様書を正とします。

## 対象範囲

このパッケージは、SNIFバイト列のcodecと、署名・トランザクション・要求／応答のverification helperを提供します。QR、ファイル、deep linkなどの搬送、永続化、requestIdの消費、接続状態の管理、利用者への表示と承認、ノード通信はホストアプリケーションの責務です。

`decode`の成功は構造とdocument内で完結する整合性だけを示します。要求との対応、現在時刻、trusted audience、connection状態、署名を必要とする判断には、対応するverification helperを使用してください。

## TypeScriptでの利用

Node.js 20以上、またはmodule Worker、Web Crypto、AbortSignal、BigIntを利用できるブラウザを対象とするESM-onlyパッケージです。

```ts
import {
  decode,
  encode,
  inspect,
  verifyRequest,
  verifyResponse,
  verifySignedTransaction,
} from '@nemnesia/symbol-nem-interchange-format';
```

- `encode(document, options)`：検証、内部CBOR、圧縮、暗号化、外側CBORの順にエンコードします。
- `decode(bytes, options)`：認証と復号を展開より先に行い、厳格に検証したdocumentを返します。
- `inspect(bytes)`：外側エンベロープだけを検証します。payloadの正当性は保証しません。
- `verifyRequest`、`verifyResponse`：ホストから明示された時刻、元要求、trusted audience、connection recordを使って検証します。
- `verifySignedTransaction`：元要求を持たない署名済みトランザクションを検証しますが、利用者承認やfinalityは保証しません。

## 他言語へ移植するためのワイヤ形式

SNIFのワイヤ値はJSON文字列ではなく、次の処理で得られる1件のCBOR itemです。特定のTypeScript型やオブジェクトのプロパティ順へ依存してはいけません。

```text
タイプ固有map
  -> RFC 8949の決定的CBOR
  -> 任意のzlib圧縮
  -> 任意のpassword-v1暗号化
  -> envelope.payloadのCBOR byte string
  -> envelope全体の決定的CBOR
```

デコードは逆順ですが、暗号化されている場合は認証を完了してから展開・内部CBOR解析を行います。未認証の平文を呼び出し側へ公開してはいけません。

### エンベロープ

外側mapは次の8フィールドだけを持ちます。キーは大文字・小文字を区別するUTF-8文字列で、未知フィールドと未知列挙値を拒否します。

```cddl
snif-envelope = {
  "protocol": "snif",
  "version": 1,
  "type": format-type,
  "chain": "symbol" / "nem",
  "network": symbol-network / nem-network,
  "compression": "none" / "zlib",
  "encryption": { "algorithm": "none" } / password-v1,
  "payload": bstr,
}

symbol-network = {
  "id": uint .le 255,
  "generationHashSeed": bstr .size 32,
}

nem-network = {
  "id": uint .le 255,
}

password-v1 = {
  "algorithm": "password-v1",
  "salt": bstr .size 16,
  "nonce": bstr .size 12,
}
```

`type`は`contact`、`address`、`account`、`mnemonic`、`sign-request`、`signed-transaction`、`message-sign-request`、`signature`、`connection-request`、`connection-response`のいずれかです。内部payloadの規範スキーマは仕様書5章にあります。

Symbolの`network`には`id`と`generationHashSeed`が必要です。NEMでは`generationHashSeed`を禁止します。アドレス、鍵、識別子、署名、ハッシュ、シリアライズ済みトランザクションは、hexやBase64ではなくCBOR byte stringで格納します。仕様書とfixtureにある`hex:`表記は診断用JSONだけの表現であり、ワイヤ形式ではありません。

### 決定的CBOR

エンベロープと内部payloadの両方にRFC 8949 4.2.1節の決定的エンコードを使用します。

- 整数は最短表現、文字列・配列・mapは確定長表現にします。
- mapキーを決定的順序に並べ、重複キーを拒否します。
- 浮動小数点、CBOR tag、`null`、`undefined`を禁止します。
- 最上位CBOR itemの後ろに残るバイトを拒否します。
- デコード後の値を再エンコードし、入力とbyte-for-byteで一致することを確認します。

整数のバイト表現はCBORに従います。チェーン固有のトランザクションは、SymbolまたはNEMが定義する完全なシリアライズ済みバイト列を不透明なCBOR byte stringとして格納し、チェーン側のsize、整数幅、byte orderを変更しません。

### テキスト

通常の文字列は正しいUTF-8のUnicode NFC、BIP39の`mnemonic`と`passphrase`はNFKDです。受信側は正規化形式を検証し、暗黙に変換してはいけません。暗号化パスワードは入力どおりUTF-8へ変換し、正規化、trim、大文字・小文字変換を行いません。

### 圧縮

`zlib`はRFC 1950のzlib streamであり、raw DEFLATEやgzipではありません。圧縮は暗号化より前に行います。展開後の上限は16 MiBで、stream後の余分なデータ、不正なheader、DEFLATE stream、Adler-32 checksumを拒否します。`account`と`mnemonic`は圧縮せず、必ず`compression: "none"`とします。

### password-v1

パスワードを入力どおりUTF-8へ変換し、16-byte saltと次の固定Argon2idパラメーターから32-byte鍵を導出します。

| パラメーター             |         値 |
| ------------------------ | ---------: |
| メモリ                   | 65,536 KiB |
| 反復回数                 |          3 |
| 並列度                   |          4 |
| 出力長                   |   32 bytes |
| version                  |     `0x13` |
| associated data / secret |         空 |

暗号化はAES-256-GCMです。nonceは毎回新しい12 bytesをOSのCSPRNGで生成します。AADはエンベロープから`payload`だけを除いたmapの決定的CBORであり、`payload`には`ciphertext || 16-byte authentication tag`を格納します。同じパスワードでsaltまたはnonceを再利用してはいけません。`account`と`mnemonic`では`password-v1`が必須です。

### 検証と制限

完全なSNIFバイト列、処理済みpayload、展開後payloadはそれぞれ最大16 MiB、トランザクションは最大8 MiBです。ネストは16階層、mapは64要素、配列は256要素を上限とします。実装は大きなメモリ確保、Argon2id、展開より前に検証可能な上限を適用してください。

移植実装は、parser固有メッセージとは別に、仕様書8.2節と同等の機械判定可能なエラーカテゴリーを公開してください。暗号認証の失敗は、誤パスワード、ciphertext破損、tag不一致を区別しない単一の復号エラーにします。

## 相互運用性の確認

[`doc/fixtures/manifest.json`](doc/fixtures/manifest.json)に登録された規範fixtureをcategory別schemaで検証し、期待されるバイト列または拒否カテゴリーと一致させてください。fixtureの診断用JSONやTypeScript実装の出力から期待値を作り直してはいけません。

現行fixtureは一部componentだけを対象とします。`codec-structural`や`transaction-primitives`の成功を、10タイプすべてのverification、要求／応答対応、接続proof、またはSNIF全体への適合と解釈しないでください。

## 開発

```bash
pnpm --filter @nemnesia/symbol-nem-interchange-format lint
pnpm --filter @nemnesia/symbol-nem-interchange-format typecheck
pnpm --filter @nemnesia/symbol-nem-interchange-format test
pnpm --filter @nemnesia/symbol-nem-interchange-format build
```
