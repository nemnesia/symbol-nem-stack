# Symbol NEM Interchange Format (SNIF) v1

ステータス: Draft 2

ワイヤバージョン: `1`

## 1. 目的と適用範囲

Symbol NEM Interchange Format（SNIF）は、SymbolおよびNEMのデータをアプリケーションや端末間で交換するための、搬送手段に依存しないバイナリ形式である。公開アカウント情報、秘密情報のバックアップ、トランザクションおよびメッセージへの署名、ウォレット接続の承認を対象とする。

本仕様は、1件の完全なSNIFバイト列までを定義する。そのバイト列をQRコード、Animated QR、ファイル、NFCレコード、Deep Linkなどへ格納する方法は、別途定義する搬送プロファイルの責務とする。分割、再構成、URIスキーム、搬送時のテキストエンコードはv1の対象外である。

### 1.1 規範用語

**必須**、**禁止**、**推奨**、**非推奨**、**任意**は規範的な要件を表す。実装がv1に適合するには、次のすべてを満たさなければならない。

- 対応するタイプについて、正しいv1データを受理する。
- 決定的にエンコードされたCBORを生成する。
- codecは構文、schema、文字列正規化、長さ、列挙値、リソース上限および暗号認証を、documentを返す前に拒否する。
- codecは、payloadの意味、チェーン上の有効性、署名、送信者、受信者、origin、permission、connection、replayまたは搬送路を認証済みとして扱ってはならない。
- 本仕様の検証規則とリソース上限を実装する。

実装が対応するフォーマットタイプは一部のみでもよい。ただし、未対応タイプを明示的に報告し、別タイプとして解釈してはならない。

### 1.2 システム境界

SNIFはデータ交換プロトコルであり、ウォレット、dApp、サーバー、ノードそのものではない。責務を次のように分離する。

| 処理             | SNIF codecの責務                                         | ホストアプリケーションまたは別仕様の責務                                                             |
| ---------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| トランザクション | 完全byte列、chain/networkおよび関連fieldの形・長さの格納 | deserialize、再serialize比較、署名・hash・ネットワーク・オンチェーン有効性の検証                     |
| request/response | requestId、context、署名・proof fieldの形・長さの格納    | 要求・応答対応付け、期限、audience、署名、connection proof、permission grant、replayの検証           |
| 接続状態         | connection request/responseのワイヤ表現                  | session、permission grant、有効期限、失効状態の保存と認可判断                                        |
| 秘密情報         | 暗号化バックアップ形式、復号、秘密型の圧縮禁止           | 鍵導出、鍵とaddressの対応、利用者端末内での鍵生成・保存・署名・消去                                  |
| 搬送             | 1件の完全なSNIF byte列まで                               | QR、file、NFC、Deep Link等への格納、送信元・送信先の認証、再送、永続化、ノード通信、オンチェーン状態 |

通常の`encode`と`decode`は外部storage、session、permission、監査状態を読み書きしない純粋なcodec操作とする。同じ引数と同じ乱数入力に対して同じ結果を返し、失敗時も外部状態を変更してはならない。SNIF packageはrequest保存、消費、再送、connection状態遷移または永続化を行うworkflow APIを提供してはならない。

SNIF packageにノード接続、トランザクション送信、DB実装、Cookie、access tokenを含めてはならない。それらを提供する製品は、成功判定、finality、再試行、冪等性、監視、復旧を別の製品仕様で定義しなければならない。ノードによる受理を承認またはfinalizedとみなしてはならない。

### 1.3 用語

| 用語               | 意味                                                                               |
| ------------------ | ---------------------------------------------------------------------------------- |
| エンベロープ       | ルーティング、コーデック、ネットワークのメタデータを持つ外側CBOR map               |
| 内部ペイロード     | 圧縮・暗号化前のタイプ固有CBOR map                                                 |
| 処理済みペイロード | `envelope.payload`へ格納するバイト列                                               |
| ヘッダー           | エンベロープから`payload`ペアを除いたmap                                           |
| 診断用JSON         | 説明用の可読表現。ワイヤ表現ではない                                               |
| codec              | SNIF byte列とdocumentを相互変換し、外部状態を変更しないコンポーネント              |
| 内容検査           | chain SDKまたは別仕様に従い、payloadの意味・署名・認可・状態を検査するホスト側処理 |

## 2. 共通データ規則

### 2.1 CBORプロファイル

SNIFは[RFC 8949](https://www.rfc-editor.org/rfc/rfc8949)のCBORを使用する。エンベロープと内部ペイロードは、いずれもRFC 8949 4.2.1節の決定的エンコード規則に従わなければならない。

- 整数は最短表現を使用する。
- mapキーは決定的順序に並べる。
- 文字列、配列、mapは確定長表現を使用する。
- mapキーの重複を禁止する。
- 浮動小数点、CBOR tag、`null`、`undefined`を禁止する。
- 1件の最上位CBOR itemより後ろにバイトが残る入力を拒否する。

v1で定義するmapキーはすべて大文字・小文字を区別するUTF-8文字列である。未知のmapキーと列挙値は不正とする。v1デコーダーは`version`が`1`でないエンベロープを拒否しなければならない。

### 2.2 テキストとバイナリ値

個別フィールドに別の規定がない限り、次を適用する。

- 文字列はUnicode NFC形式の正しいUTF-8とする。ただし、5.4節のBIP39 `mnemonic`と`passphrase`はNFKD形式とする。
- 表示用文字列ではU+0000〜U+001FおよびU+007Fを禁止する。
- 空文字列を禁止する。
- 暗号値、アドレス、識別子、シリアライズ済みトランザクションは、hexやBase64文字列ではなくCBOR byte stringを使用する。
- 本文記載のバイト長は厳密な長さを表す。

受信側は指定された正規化形式を検証し、受信文字列を暗黙に正規化してはならない。暗号化パスワードは6章の規則に従い、いかなるUnicode正規化も行わない。

`audience`、`origin`、`iconUrl`は[RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)の`absolute-URI`構文に適合しなければならない。デコーダーは構文を検証するが、scheme・hostの大文字小文字、percent-encoding、既定port、pathのdot segmentを正規化してはならず、相対URIの解決も行ってはならない。本文で一致を要求するURIは、受信した元の文字列をUnicode code point単位で完全一致させる。`iconUrl`のHTTPS判定に限りschemeをASCII case-insensitiveで比較し、それ以外の部分は変更しない。

診断用JSONではbyte stringを`hex:`に続く大文字16進文字列で表す。この表記は説明用であり、ワイヤ形式ではない。

### 2.3 リソース上限

デコーダーは、攻撃者が制御できる入力を基にデコードやメモリ確保を行う前に、次の上限を適用しなければならない。

| 対象                             |             最大値 |
| -------------------------------- | -----------------: |
| 完全なSNIFバイト列               |             16 MiB |
| 処理済みペイロード               |             16 MiB |
| 展開後の内部ペイロードCBOR       |             16 MiB |
| ネスト深度                       |             16階層 |
| map要素数                        |      1 mapにつき64 |
| 配列要素数                       |     1配列につき256 |
| 一般表示文字列                   | UTF-8で1,024 bytes |
| `name`                           |    128 UTF-8 bytes |
| `origin`と`iconUrl`              |  2,048 UTF-8 bytes |
| `purpose`                        |    256 UTF-8 bytes |
| メッセージ                       |              1 MiB |
| シリアライズ済みトランザクション |              8 MiB |
| パスワード入力                   | UTF-8で1,024 bytes |

搬送手段やアプリケーションは、解析前により小さい上限を適用してもよい。適合エンコーダーは上限を超える値を生成してはならない。

## 3. ワイヤ形式

### 3.1 エンコード手順

送信側は次の処理を順番どおりに行わなければならない。

```text
type-specific map
  -> deterministic CBOR encoding
  -> optional zlib compression
  -> optional password-v1 encryption
  -> envelope.payload byte string
  -> deterministic CBOR envelope encoding
```

受信側は逆順に処理しなければならない。

```text
decode and validate envelope
  -> authenticate and decrypt, when enabled
  -> decompress with an output limit, when enabled
  -> decode and validate exactly one inner payload map
```

展開または内部CBORのデコードより先に認証を完了しなければならない。未認証の平文をアプリケーションへ返してはならない。

### 3.2 エンベロープスキーマ

次のCDDLを規範スキーマとする。

```cddl
snif-envelope = {
  "protocol": "snif",
  "version": 1,
  "type": format-type,
  "chain": chain,
  "network": network,
  "compression": compression,
  "encryption": encryption,
  "payload": bstr,
}

format-type =
  "contact" /
  "address" /
  "account" /
  "mnemonic" /
  "sign-request" /
  "signed-transaction" /
  "message-sign-request" /
  "signature" /
  "connection-request" /
  "connection-response"

chain = "symbol" / "nem"

network = symbol-network / nem-network
symbol-network = {
  "id": uint .le 255,
  "generationHashSeed": bstr .size 32,
}
nem-network = {
  "id": uint .le 255,
}

compression = "none" / "zlib"

encryption = no-encryption / password-v1
no-encryption = { "algorithm": "none" }
password-v1 = {
  "algorithm": "password-v1",
  "salt": bstr .size 16,
  "nonce": bstr .size 12,
}
```

`network`は`chain`と一致しなければならない。Symbolでは`generationHashSeed`が必須であり、NEMでは禁止する。ネットワークIDはアドレスとトランザクションへ埋め込まれる1-byte識別子である。アプリケーションはID単独ではなくネットワーク情報全体を比較することを推奨する。特にSymbolネットワークは`id`と`generationHashSeed`の両方で識別する。

### 3.3 ペイロードの振り分け

暗号化と圧縮を解除した`payload`は、`type`が指定するスキーマへデコードできなければならない。受信側がペイロードのフィールドからタイプを推測してはならない。

内部ペイロードCBORも決定的エンコードでなければならない。受信側はデコード値を再エンコードし、元の内部ペイロードとbyte-for-byteで比較する。不一致は不正とする。

### 3.4 エンベロープ例

次の診断用JSONは、CBORエンコード前の暗号化されていないSymbolアドレスエンベロープを表す。

```json
{
  "protocol": "snif",
  "version": 1,
  "type": "address",
  "chain": "symbol",
  "network": {
    "id": 152,
    "generationHashSeed": "hex:57F7DA205008026C776CB6AED843393F04CD458E7D55817A54BEBDD4058A7D54"
  },
  "compression": "none",
  "encryption": {
    "algorithm": "none"
  },
  "payload": "hex:A167616464726573735818988E1191A25A88142C2FB3F69787576E3DC713EFC1CE4DE9"
}
```

## 4. チェーン固有値

### 4.1 アドレス

アドレスはBase32文字列ではなく、デコード済みバイナリアドレスを格納する。

| チェーン |     長さ |
| -------- | -------: |
| Symbol   | 24 bytes |
| NEM      | 25 bytes |

codecはアドレスの長さだけを検証する。先頭network byte、checksumおよびアドレスの意味的な有効性は検証しない。UIは大文字Base32の正規表現で表示し、入力時にハイフンを許容してもよいが、ワイヤ値は常にデコード済みbyte stringとする。

### 4.2 鍵、ハッシュ、署名

| 値               |     長さ |
| ---------------- | -------: |
| 秘密鍵           | 32 bytes |
| 公開鍵           | 32 bytes |
| SHA3-256ハッシュ | 32 bytes |
| Ed25519系署名    | 64 bytes |

全byteがゼロの公開鍵、秘密鍵、ハッシュ、署名は不正とする。codecは長さと全ゼロ値だけを検証し、公開鍵の曲線上の有効性、署名の正しさ、または導出関係にある値の再計算・比較を行わない。

本仕様におけるSHA3-256は[FIPS 202](https://csrc.nist.gov/pubs/fips/202/final)のSHA3-256を意味し、Ethereumで通称Keccak-256と呼ばれる関数を意味しない。

### 4.3 トランザクション

`transactionPayload`は対象チェーンが定義する完全なシリアライズ済みトランザクションである。トランザクションをちょうど1件含まなければならない。codecはbyte stringの型と8 MiB上限を検証する。本仕様はtransactionのtype、fee、deadline、recipient、mosaic、messageまたはon-chain有効性を解釈しない。これらを確認するための完全なbyte列、chainおよびnetworkを使用者へ伝達する。

SNIFはSymbolまたはNEMのトランザクション形式、トランザクションハッシュ、署名アルゴリズムを再定義しない。codecは`transactionPayload`をdeserialize、再serialize、署名検証またはnetwork照合してはならない。使用者がこれらを必要とする場合は、対象chainのプロトコル仕様およびSDKに従う別の内容検査を実行しなければならない。

## 5. フォーマットタイプ

### 5.1 連絡先: `contact`

名前付きの公開アカウント情報を格納する。権限付与、所有証明、本人性証明のいずれも意味しない。

```cddl
contact-payload = {
  "name": text .size (1..128),
  "address": chain-address,
  ? "publicKey": bstr .size 32,
}
```

`publicKey`が存在する場合、受信側はエンベロープのネットワークを用いてアドレスを導出し、`address`と一致することを検証しなければならない。

```json
{
  "name": "Example account",
  "address": "hex:988E1191A25A88142C2FB3F69787576E3DC713EFC1CE4DE9"
}
```

### 5.2 アドレス: `address`

送金先またはアカウントのアドレスを1件格納する。

```cddl
address-payload = {
  "address": chain-address,
}
```

```json
{
  "address": "hex:988E1191A25A88142C2FB3F69787576E3DC713EFC1CE4DE9"
}
```

### 5.3 アカウントバックアップ: `account`

秘密鍵1件と、そこから導出される公開情報を格納する。`encryption.algorithm`は`password-v1`を必須とし、暗号化されていないアカウントペイロードは不正とする。

```cddl
account-payload = {
  "privateKey": bstr .size 32,
  "publicKey": bstr .size 32,
  "address": chain-address,
}
```

復号後、受信側は`privateKey`から`publicKey`を、公開鍵とネットワークから`address`を導出して比較しなければならない。可能な実行環境では定数時間比較を用い、いずれかが不一致なら秘密情報を返してはならない。

### 5.4 ニーモニックバックアップ: `mnemonic`

BIP39復元フレーズを格納する。`encryption.algorithm`は`password-v1`を必須とする。

```cddl
mnemonic-payload = {
  "scheme": "bip39",
  "language": bip39-language,
  "mnemonic": text .size (1..1024),
  ? "passphrase": text .size (0..1024),
}

bip39-language =
  "english" / "japanese" / "korean" /
  "spanish" / "chinese-simplified" /
  "chinese-traditional" / "french" /
  "italian" / "czech" / "portuguese"

```

`mnemonic`と`passphrase`はUnicode NFKD形式とする。単語間はASCII space 1文字とし、日本語でもワイヤ値にはASCII spaceを使用する。`passphrase`はニーモニック復元処理へ渡す値であり、UIの暗号化パスワードとは別物である。codecはBIP39単語リスト、checksum、seedまたはchain別の鍵導出を検証しない。これらの意味検証と復元方法は、ホストまたは別仕様が対象chainと利用するニーモニック方式に従って定義する。

```json
{
  "scheme": "bip39",
  "language": "english",
  "mnemonic": "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
}
```

### 5.5 トランザクション署名要求: `sign-request`

通常のトランザクション署名または連署を要求する。

```cddl
sign-request-payload = {
  "transactionPayload": bstr .size (1..8388608),
  "signingType": "transaction" / "cosignature",
  "context": request-context,
  ? "expectedSignerPublicKey": bstr .size 32,
  ? "connection": connection-proof,
}
```

codecは`transactionPayload`を不透明なbyte列として扱う。`signingType`、`context`、`expectedSignerPublicKey`および`connection`は指定されたfield形状・長さ・列挙値だけを検証する。トランザクションが署名可能か、連署対象か、要求者または応答者の鍵と一致するか、期限内か、または接続済みかの判断は、ホストまたは別の検証仕様の責務とする。

### 5.6 署名済みトランザクション: `signed-transaction`

1件以上の署名が追加された完全なトランザクションを格納する。

```cddl
signed-transaction-payload = {
  "transactionPayload": bstr .size (1..8388608),
  ? "requestId": request-id,
}
```

トランザクションは追加連署を必要としてもよい。codecはtransaction payloadを不透明なchain固有byte列として構造検証し、署名検証済みとは扱わない。署名要求への応答として生成する場合は`requestId`を必須とし、独立した署名済みtransactionの搬送に限り省略してよい。

`requestId`が存在する場合、hostは元の`sign-request`を対応付けに使用する。SNIFはrequestId、chain、network、transactionPayload、署名およびhashを伝達するが、transaction内容の妥当性または要求と応答の業務上の同一性を判定しない。

`requestId`が存在しても、codecは元の`sign-request`との対応、署名対象、署名者、トランザクションhash、またはオンチェーン有効性を検証しない。対応付け、表示、承認、署名可否、requestIdの消費および状態遷移はホストの責務とする。

### 5.7 メッセージ署名要求: `message-sign-request`

任意のbyte列への署名要求に関連する検証材料を格納する。

```cddl
message-sign-request-payload = {
  "message": bstr .size (0..1048576),
  "purpose": text .size (1..256),
  "context": request-context,
  ? "expectedSignerPublicKey": bstr .size 32,
  ? "connection": connection-proof,
}
```

SNIF coreはメッセージの署名対象byte列、domain分離、hash関数、対象chainの署名方式、署名者または元要求との照合を定義しない。codecは`message`、`purpose`、`context`および任意の`connection`を構造的に搬送するだけである。本仕様には署名プロファイルを含まないため、ホストはこれらの値を署名済み、認証済みまたはreplay防止済みとして扱ってはならない。将来の別仕様は、名前付きプロファイル、署名対象、検証者、期限、audienceおよびrequestIdの消費を一意に定義しなければならない。

```json
{
  "message": "hex:4C6F67696E206368616C6C656E67653A20616263313233",
  "purpose": "authentication",
  "context": {
    "requestId": "hex:00112233445566778899AABBCCDDEEFF",
    "createdAt": 1735689600,
    "expiresAt": 1735690200,
    "audience": "https://example.com"
  }
}
```

### 5.8 署名結果: `signature`

完全なトランザクションを再構築せず、署名1件を格納する。

```cddl
signature-payload = detached-signature / symbol-cosignature / nem-cosignature / rejected-signature

detached-signature = {
  "signatureType": "transaction" / "message",
  "signature": bstr .size 64,
  "signerPublicKey": bstr .size 32,
  "targetHash": bstr .size 32,
  "requestId": request-id,
}

symbol-cosignature = {
  "signatureType": "cosignature",
  "parentHash": bstr .size 32,
  "signature": bstr .size 64,
  "signerPublicKey": bstr .size 32,
  "version": uint,
  "requestId": request-id,
}

nem-cosignature = {
  "signatureType": "cosignature",
  "transactionPayload": bstr .size (1..8388608),
  "requestId": request-id,
}

rejected-signature = {
  "signatureType": "rejected",
  "requestId": request-id,
}
```

エンベロープの`chain`によって許容する結果を切り替える。Symbolでは`symbol-cosignature`、NEMでは`nem-cosignature`だけを連署結果として許可する。Symbolの`symbol-cosignature.version`はv1では`0`だけを許可する。

`rejected-signature`は5.5節または5.7節の要求に対する拒否を表す。情報最小化のためrequestId以外を含めず、署名されない。codecは拒否documentをdecodeできるが、拒否元、元要求との対応、または拒否の真正性を確認しない。

`detached-signature.targetHash`は、別の名前付き署名プロファイルが定義する署名対象を識別する32-byte値である。SNIF coreはその導出・照合を行わない。

NEMの`transactionPayload`、Symbolの`parentHash`、`signerPublicKey`および`signature`は、codecにとって不透明な検証材料である。元要求との対応、target hash、signer、chain、network、署名および期限の検証、一回限り消費と冪等性はホストの責務とする。

### 5.9 ウォレット接続要求: `connection-request`

ウォレットに対して、公開アカウント情報と将来の署名要求を関連付ける接続の承認を要求する。

```cddl
connection-request-payload = {
  "application": application-metadata,
  "permissions": [1*3 connection-permission],
  "challenge": bstr .size 32,
  "context": request-context,
  "requesterPublicKey": bstr .size 32,
  "signature": bstr .size 64,
}

application-metadata = {
  "name": text .size (1..128),
  "origin": text .size (1..2048),
  ? "iconUrl": text .size (1..2048),
}

connection-permission =
  "account" / "sign-transaction" / "sign-message"

```

`permissions`は重複を含まず、`account`を必須とする。未知のpermissionを含む要求は全体を拒否する。`challenge`は要求ごとにOS CSPRNGで生成した32 bytesとし、すべてゼロの値と再利用を禁止する。

`requesterPublicKey`と`signature`は接続要求の検証材料である。codecはその長さと全ゼロ値だけを検証し、署名対象の生成、署名検証、鍵所有または要求改ざん防止を保証しない。本仕様にはconnection profileを含まないため、ホストはこの要求から接続状態、permission grantまたは自動署名の権限を作成してはならない。将来の別仕様は、名前付きprofile、署名対象、対象chainの方式、署名者、要求・応答対応、challenge、requestId、permissionおよびreplayの検証手順を一意に定義しなければならない。

`origin`はapplicationを表すabsolute URI、`iconUrl`は指定する場合HTTPSのabsolute URIとする。ただし、`name`、`origin`、`iconUrl`はすべて要求者の自己申告による表示情報であり、applicationの本人性、domain所有、搬送元、認証済みoriginを証明しない。ウォレットはこの情報だけを根拠に自動承認してはならない。コア実装は`iconUrl`を取得せず、ホストが取得する場合はSSRF、追跡、過大response、redirect、media typeを制限する。

`connection-request`では`context.audience`と`application.origin`をUnicode code point単位で完全一致させなければならない。この一致は要求内部の整合性だけを示し、originの真正性を証明しない。

表示方法と接続承認はhostの責務とする。接続承認は公開情報の開示とローカルなpermission grantを意味するが、秘密鍵の開示、トランザクションの自動署名、サーバー認証、chain上の権限変更を意味しない。

### 5.10 ウォレット接続応答: `connection-response`

```cddl
connection-response-payload = connection-approved / connection-denied

connection-approved = {
  "approved": true,
  "requestId": request-id,
  "sessionId": request-id,
  "sessionCreatedAt": uint .le 253402300799,
  "sessionExpiresAt": uint .le 253402300799,
  "account": account-reference,
  "permissions": [1*3 connection-permission],
  "signature": bstr .size 64,
}

connection-denied = {
  "approved": false,
  "requestId": request-id,
}

account-reference = {
  "address": chain-address,
  "publicKey": bstr .size 32,
}

```

承認時の`sessionId`、時刻、`account`、`permissions`および`signature`は指定されたfield形状・長さ・列挙値を満たさなければならない。`sessionCreatedAt < sessionExpiresAt`とし、有効期間は最大30日とする。codecは`sessionId`の生成または再利用、現在時刻、有効期限、要求permissionsの部分集合、鍵からのaddress導出、署名または元要求との対応を検証しない。

拒否時は情報最小化のため`approved: false`と元の`requestId`以外を含めてはならない。拒否応答には署名がないため、codecは拒否元または拒否の真正性を確認できない。

将来のconnection profileを実装するホストは、sessionId、requesterPublicKey、requester表示情報、account、permissions、有効期限、失効状態をオフチェーンで管理する。`sessionId`は照合用識別子であり、単独ではbearer tokenまたは認証証明ではない。profileは、期限切れ、失効済みまたは消費済みrequestIdのresponseを拒否し、承認responseのpermissionsが保存済みrequestの重複なしの部分集合であることを必須にしなければならない。connection proof、接続状態、permission grant、署名対象の表示、要求contextの検証および利用者承認はホストの責務であり、接続済みであることを理由に省略してはならない。

### 5.11 共通CDDL定義

```cddl
chain-address = symbol-address / nem-address
symbol-address = bstr .size 24
nem-address = bstr .size 25
request-id = bstr .size 16
request-context = {
  "requestId": bstr .size 16,
  "createdAt": uint .le 253402300799,
  "expiresAt": uint .le 253402300799,
  "audience": text .size (1..256),
}
connection-proof = {
  "sessionId": request-id,
  "requesterPublicKey": bstr .size 32,
  "signature": bstr .size 64,
}
```

エンベロープのchainによって`chain-address`の分岐を決定する。Symbolエンベロープに25-byteのNEMアドレスを格納すること、およびその逆を禁止する。

requestIdは衝突耐性を持つ不透明な16-byte識別子で、全ゼロ値を禁止する。時刻はUTCのUnix秒とし、`createdAt < expiresAt`かつ有効期間は最大24時間とする。codecはrequestIdの生成、再利用、現在時刻との比較またはreplayを検証しない。

audienceはUTF-8で1から256 bytesのabsolute URIである。CDDLの`.size`は構造表現であり、適合codecはこのUTF-8 byte上限を別途検証しなければならない。codecはURI構文と、`connection-request`における`application.origin`との完全一致だけを検証する。`audience`、`origin`、`iconUrl`および接続の署名・proofは自己申告または未検証のpayloadであり、application、domain、送信者、接続またはpermissionを認証しない。ホストは認証済み搬送路または独自の信頼設定を用いて、必要な照合、期限検証、replay防止、request/response対応付けおよびpermission判定を行わなければならない。

## 6. パスワード暗号化プロファイル

### 6.1 適用条件

`password-v1`はワイヤバージョン1で唯一の暗号化プロファイルである。`account`と`mnemonic`では必須とし、ほかのタイプでも使用してよい。`account`と`mnemonic`の`compression`は`none`を必須とする。公開鍵暗号は将来プロファイル用に予約する。

暗号処理の実装は同一SNIFパッケージ内の独立したproviderまたはモジュール境界へ分離し、通常APIから安全な既定実装を利用できるようにする。この分離によって以下のワイヤアルゴリズムは変化しない。

### 6.2 パスワードと鍵導出

1. 空でないパスワードを入力どおりUTF-8へ変換する。Unicode正規化、trim、大文字・小文字変換を禁止する。
2. パスワードはUTF-8で1,024 bytes以下とする。
3. 送信側は暗号学的に安全な16-byte saltを生成する。
4. [RFC 9106](https://www.rfc-editor.org/rfc/rfc9106)のArgon2idを、次の固定パラメーターで実行し32-byte鍵を導出する。

| パラメーター     |         値 |
| ---------------- | ---------: |
| メモリサイズ     | 65,536 KiB |
| 反復回数         |          3 |
| 並列度           |          4 |
| 出力長           |   32 bytes |
| associated data  |         空 |
| secret値         |         空 |
| Argon2バージョン |     `0x13` |

パラメーターはプロファイルによって固定し、攻撃者が制御できるエンベロープフィールドにはしない。将来の変更には別の暗号化プロファイル識別子を使用する。

### 6.3 AES-256-GCM

送信側は毎回新しい暗号学的に安全な12-byte nonceを生成し、[NIST SP 800-38D](https://csrc.nist.gov/pubs/sp/800/38/d/final)のAES-256-GCMで圧縮済みまたは未圧縮の内部ペイロードを暗号化する。

追加認証データ（AAD）は、エンベロープmapから`payload`ペアだけを除いた完全なヘッダーを決定的CBORでエンコードしたbyte列とする。これによりprotocol、version、type、chain、network、compression、暗号化アルゴリズム、salt、nonceを認証対象に含める。

`envelope.payload`には次の順で連結したbyte列を格納する。

```text
ciphertext || authentication-tag
```

authentication tagは厳密に16 bytesとし、ciphertextの後ろへ連結する。独立したmap値にはしない。v1の内部ペイロードは必ず空でないCBOR mapであるため、空の平文は不正とする。

同一パスワードでのsaltまたはnonce再利用を禁止する。乱数生成にはOSのCSPRNGを使用する。通常の公開APIで呼び出し側指定のsaltやnonceを受け取ってはならない。決定値の注入はテスト専用コードに限ってよい。

### 6.4 復号動作

受信側は次を満たさなければならない。

1. Argon2id実行前にエンベロープの形とサイズを検証する。
2. プロファイル固定パラメーターで鍵を導出する。
3. 平文を公開する前にAADとciphertextを認証する。
4. パスワード不一致、ciphertext破損、認証失敗を区別できない単一の復号エラーとして返す。
5. 6.5節に従い、使用済みの秘密情報をベストエフォートで消去する。

旧アルゴリズムや別の正規化規則で再試行してはならない。

### 6.5 秘密情報のライフサイクル

本節の秘密情報には、パスワード、アカウント秘密鍵、接続用一時秘密鍵、ニーモニック、BIP39 passphrase、導出鍵、およびそれらを含む未暗号化のCBOR・圧縮前後の一時bufferを含む。

暗号化側と復号側は、成功、失敗、例外、利用者による中断のすべての経路で、秘密情報が不要になり次第、次の処理をベストエフォートで行わなければならない。

- 実装が所有する上書き可能なbufferは、`finally`相当の処理で全領域をゼロまたはランタイム推奨の消去値に上書きする。パスワードbyte列、秘密鍵、導出鍵、復号済みペイロード、および暗号処理ライブラリへ渡すために作成した一時コピーを明示的に対象とする。
- 秘密情報のコピーと保持時間を最小化し、不要な文字列変換、連結、再エンコード、キャッシュを避ける。
- 公開APIは、可能であればパスワードと秘密鍵をimmutableな文字列ではなく、呼び出し側が消去できるmutableなbyte列でも受け取れるようにする。
- APIは入力bufferの所有権と消去責任を明記する。実装が呼び出し側所有bufferを無断で変更してはならない。所有権を移譲しないAPIでは呼び出し側が使用後に入力bufferを消去し、実装は内部コピーを消去する。
- 復号結果として秘密情報を呼び出し側へ返す場合、その時点で消去責任を呼び出し側へ移譲することをAPI文書へ明記する。呼び出し側も利用完了後に同じ規則で消去する。
- garbage collectionを使用するランタイムでは、immutableな文字列、ランタイム内部コピー、JIT最適化、swap、core dumpからの完全消去を保証できない。実装は保証できない消去を「安全に消去した」と表現せず、参照を速やかに破棄し、可能な範囲でmutable bufferを使用する。

メモリ消去は、秘密情報をlog、例外メッセージ、telemetry、永続storage、clipboardへ出力しない要件の代替にはならない。

## 7. 圧縮プロファイル

`compression: "zlib"`は、[RFC 1950](https://www.rfc-editor.org/rfc/rfc1950)のzlibデータストリーム内にRFC 1951のDEFLATEデータを格納することを意味する。raw DEFLATEおよびgzipではない。

エンコーダーは、圧縮処理を含めても処理済みペイロード全体が小さくなる場合に限りzlibを選択することを推奨する。デコーダーはstream処理などで展開出力を16 MiBに制限し、超過時は即座に中断して`resource-limit`を返さなければならない。zlib stream後に1 byte以上の余分なdataがある場合は`invalid-payload`として拒否しなければならない。zlib header、DEFLATE streamまたはAdler-32 checksumが不正な場合も`invalid-payload`とする。`unsupported-codec`は、構文上正しいが実装が対応しない圧縮または暗号化profileに限って使用し、既知の`zlib` streamの破損には使用してはならない。

圧縮は暗号化より前に行う。`account`と`mnemonic`では`none`だけを許可し、`zlib`を受信した場合は`invalid-envelope`として拒否する。

## 8. 検証とエラー

### 8.1 検証順序

codecの`decode`は次の順序で検証しなければならない。

1. 搬送手段から得られるbyte長（判明している場合）
2. 外側CBORの構文、決定性、重複キー、リソース上限
3. protocol、version、列挙値、エンベロープフィールド型、chain/network整合性
4. 暗号化プロファイルの形と処理済みペイロード長
5. 認証と復号
6. 展開と展開後サイズ
7. 内部CBORの構文、決定性、厳密なスキーマ、リソース上限
8. payload fieldの長さ、全ゼロ禁止、列挙値、文字列正規化および型固有の構造規則

codecは外部storageを読み書きしない。hostは利用者向け表現へ変換してもよいが、logへパスワード、秘密鍵、ニーモニック、復号済みペイロード、署名対象challenge全体を出力してはならない。

### 8.2 エラーカテゴリー

公式TypeScript実装はparser固有メッセージではなく、次の安定したカテゴリーを`SnifError.code`として必ず公開しなければならない。ほかの適合実装も、名称または値が異なっても同等の機械判定可能なカテゴリーを公開しなければならない。

| カテゴリー            | 意味                                                       |
| --------------------- | ---------------------------------------------------------- |
| `invalid-envelope`    | 外側CBORまたはスキーマが不正・非決定的                     |
| `unsupported-version` | `protocol`はSNIFだが`version`が未対応                      |
| `unsupported-type`    | SNIF versionは正しいがtypeが未実装                         |
| `unsupported-codec`   | 構文上正しい圧縮または暗号化プロファイルが未対応           |
| `password-required`   | 暗号化データに対してpasswordが指定されていない             |
| `decryption-failed`   | パスワード、ciphertext、認証の失敗                         |
| `resource-limit`      | 宣言値または生成値が上限超過                               |
| `operation-cancelled` | 利用者またはAbortSignalによって処理が中断された            |
| `entropy-unavailable` | OS CSPRNGから必要な乱数を取得できない                      |
| `invalid-payload`     | 内部CBOR、タイプ固有スキーマ、または既知codec streamが不正 |
| `invalid-context`     | request contextまたは同一document内のcontext整合性が不正   |

実装はローカル診断情報を付加してもよいが、暗号処理の詳細な失敗理由をtrust boundaryの外へ公開してはならない。

## 9. バージョニングと拡張方針

ワイヤバージョン`1`は厳格に解釈する。v1エンコーダーは本仕様のフィールドと列挙値だけを出力する。v1デコーダーは未知フィールドを破棄・保持せず拒否しなければならない。

フィールドの意味、署名対象byte列、暗号処理、許容値を変える場合、新しいワイヤバージョンまたは名前付きcodec profileを必要とする。将来仕様で最上位format typeを追加してもよいが、旧実装は`unsupported-type`を返し、推測してはならない。

搬送プロファイルは不透明な完全SNIFバイト列を扱うため、コア仕様から独立して発展してよい。

## 10. 適合テストベクトル

Draft 2を安定版へ昇格する前に、本仕様から生成した機械可読な適合fixtureをリポジトリへ追加しなければならない。

規範fixtureの入口は`doc/fixtures/manifest.json`とする。manifestに登録されていないファイルをcodec適合性の根拠にしてはならない。各manifest entryの`category`に対応するJSON Schemaをfixture本体のデータ形状、必須field、および期待値表現の正本とする。loaderはmanifest entryの`id`とfixture本体の`id`が完全一致することを検証しなければならない。

encoder適合用wire-format fixtureは次を含まなければならない。

- 診断用入力値
- 内部ペイロードの決定的CBOR（16進）
- 完全なエンベロープの決定的CBOR（16進）
- 期待デコード値または期待エラーカテゴリー
- 暗号化ケースではテスト専用の固定password、salt、nonce、導出鍵、AAD、ciphertext、authentication tag

各規範caseは、適合実装が実装固有constant、暗黙のmutation手順、または外部状態を追加せず実行できる完全な入力を含まなければならない。byte列を扱うcaseは入力および変異後の完全byte列を大文字16進で格納しなければならない。`mutation`、`baseCase`、`expression`などの説明だけを規範入力としてはならない。

署名、proof、transaction、hashまたはframeの意味を検証するcaseはcore codecの適合fixtureに含めてはならない。必要な場合は、対象chainまたはホストの別仕様で、外部引数、期待結果および検証手順を定義する。

Unicode mnemonic適合fixtureは、NFKDおよびASCII spaceの文字列規則を検証する。BIP39 seedまたはchain別導出値はcore codec適合の対象外とする。

- 日本語は`bip32JP/bip32JP.github.io`の`test_JP_BIP39.json`先頭vector（entropy `00000000000000000000000000000000`）を採用する。元vectorのIDEOGRAPHIC SPACEはSNIFワイヤ値でASCII spaceへNFKD正規化し、互換文字を含むpassphrase `㍍ガバヴァぱばぐゞちぢ十人十色`もNFKD正規化したbyte列を格納する。
- スペイン語は`trezor/python-mnemonic`の`vectors.json`にあるSpanish先頭vector（entropy `00000000000000000000000000000000`）を採用する。mnemonic中のアクセント付き文字はNFKD表現を格納する。
- 空passphraseは、同じSpanish先頭mnemonicと空文字列を入力とするSNIF固有vectorで固定する。
- 1,024 UTF-8 bytes境界は、NFKD文字列`e\u0301`を341回連結し、末尾へASCII `a`を1文字連結した値（`3 * 341 + 1 = 1,024 bytes`）をpassphraseとする。末尾の`a`を2文字へ増やした1,025-byte値は`invalid-payload`となる。

NFC入力拒否fixtureでは、上記境界vectorと同じUnicode scalar列をNFCへ変換した値を入力とし、`invalid-payload`を期待する。受信側がNFC入力を暗黙にNFKDへ変換して受理してはならない。

manifestの`category`は、対応するcategory別JSON Schemaとloaderのschema対応表が同じ変更で追加された場合にだけ追加してよい。既存categoryのfieldの意味または期待値表現を互換性なく変更してはならない。この変更が必要な場合は、新しいcategory名と新しいcategory別JSON Schemaを追加し、既存categoryを保持しなければならない。loaderは未知のcategoryを推測せず拒否しなければならない。

`codec-structural` fixtureはdecoder専用であり、完全なエンコーダー入力またはencoder適合の根拠ではない。各caseの`input`は期待するformat typeを示すselectorであり、期待envelopeの生成に使ってはならない。codecが外部contextなしに受理するdocument構造を表す。decode成功はchain transaction、署名、connection proof、利用者承認または接続の検証成功を意味しない。

現行のcore規範categoryは`codec-structural`、`password-v1`、`secret-backup`、`zlib`、`mnemonic-unicode`および`cbor-envelope`とする。`transaction-primitives`と`mnemonic-derivation`はchain意味検証用の補助資料であり、core codec適合またはrelease判定の根拠にしてはならない。`secret-backup`は`account`と`mnemonic`について、完全SNIF入力、固定password、復号済みpayload、誤password、AAD header改変、tag改変、password未指定および禁止されたzlib圧縮を固定する。秘密typeで`compression`が`"none"`以外であるcaseは各typeにつき少なくとも1件を登録し、decoderはpassword導出、復号、展開または内部payloadのdecodeより前に`invalid-envelope`として拒否しなければならない。具体的な入力と期待値はmanifestから参照されるfixture本体を正とし、本文の例または実装内のtest constantで置き換えてはならない。

最低限のfixture matrixを次に示す。

| 対象     | 必須ケース                                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------- |
| タイプ   | v1の10タイプについて正しいfixture 1件以上                                                                               |
| チェーン | SymbolとNEMのアドレスおよびトランザクションの長さ・field構造各1件以上                                                   |
| 暗号化   | 正しいaccountとmnemonic、誤パスワード、header改変、tag改変                                                              |
| 圧縮     | 正しいzlib、raw-DEFLATE拒否、末尾データ拒否、展開上限                                                                   |
| CBOR     | 非最短整数、不定長、重複キー、誤ったキー順、末尾item                                                                    |
| 構造     | 鍵・アドレス・signature・proofの長さ、全ゼロ値、未知field、未知permission、requestIdおよび同一document内のcontext整合性 |
| 署名材料 | transaction、message、connectionの署名・proof fieldを不透明なbyte列として往復するcase                                   |

未圧縮の決定的CBORと、固定salt・nonceを使用する暗号化fixtureではbyte-for-byte一致を必要とする。zlibは同じ入力に複数の正しいstreamを生成できるため、圧縮fixtureは展開後のbyte列、zlib profile、末尾data、上限によって適合性を判定し、圧縮byte列そのものの一致は要求しない。全不正fixtureは指定カテゴリーで拒否しなければならない。fixture生成器を独立したプロトコル規則の情報源としてはならず、不一致時は本文を正とする。

zlib componentのPhase 1 fixtureは、展開後16 MiBを受理し、byte長とSHA-256がfixture期待値へ一致することを確認しなければならない。16 MiB+1の完全zlib streamは、内側CBORの検証前に`resource-limit`として拒否しなければならない。これらの境界caseは、SNIFのdocument payloadとして有効である必要はなく、zlib展開処理自体を直接検証する。package全体または他componentのPhaseを昇格させる根拠にしてはならない。

各format typeの実装完了条件は、対応する正常fixture、境界値fixture、不正fixtureを追加し、独立したdecoderで期待値を確認することである。fixtureがないtypeをrelease済み機能として表示してはならない。

実装はfixture-firstで進める。各componentの最初の変更は、本文から人手で導出してreview済みとなった入力・期待byte列・期待結果をmanifestへ登録し、そのfixtureが未実装コードに対して失敗するtestを追加することとする。そのcomponentのencoder、decoder、暗号処理、署名処理をfixtureより先に実装してはならない。fixture生成toolは期待値を上書きせず、review済みfixtureとの差分を報告するだけとする。この手順に限り、全fixtureが揃う前でも未着手componentのfixture追加から実装を開始してよい。

実装ゲートを次のように固定する。Phase 1はcomponent単位で進め、ほかのcomponentのfixture完成を待つ必要はない。

| Phase | 着手可能な作業                                                                            | 完了条件                                                                         |
| ----- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 0     | 最小package骨格、fixture schema、manifest loader、fixture追加、未実装に対して失敗するtest | fixtureを追加・review・実行できる共通基盤が成功                                  |
| 1     | fixture登録済みcodec component                                                            | 当該componentの正常・境界・異常fixtureがすべて成功                               |
| 2     | 公開codec APIのend-to-end統合                                                             | Node.jsとbrowserでcomponent間の相互運用、失敗伝播、資源制限のfixtureがすべて成功 |
| 3     | 安定版公開                                                                                | 10タイプのwire・profile matrix、Symbol/NEM相互運用、公開codecの全適合testが成功  |

現行のfixture登録状況は`doc/fixtures/manifest.json`を正とする。全体phaseは、manifestに登録されたfixture、共通loader／test基盤、および上表の完了条件から決定する。ただし、各componentは対応fixtureが先に登録・review済みであれば個別にPhase 1へ進めてよい。fixtureより先に同じcomponentの実装を追加してはならない。

v1ではpackage全体を単一のDraftとして扱う。全10タイプと公開codecに必要なwire・profile fixture matrixがPhase 3の完了条件を満たすまで、packageを安定版として公開registryへpublishしてはならず、いずれかのcomponentだけをrelease済みまたは適合済みと表示してはならない。開発用buildでfixture完成済みcomponentを試験することは妨げないが、そのbuildは非公開のpre-releaseとして明示しなければならない。component単位の段階的な公開はv1の対象外とする。

## 11. TypeScript公開API

公式TypeScript実装は単一のESM-only `@nemnesia/symbol-nem-interchange-format` packageとして公開し、Node.js 20以上とmodule Worker、Web Crypto、AbortSignal、BigIntを利用できるbrowserを対象とする。通常利用者に圧縮・暗号化の手順を委ねず、公開entry pointは副作用のないcodecだけを提供する。`./core`または`./workflow` subpathを公開してはならない。

### 11.1 Codec API

```ts
type Password = string | Uint8Array;

interface EncodeOptions {
  password?: Password;
  compression?: 'auto' | 'none' | 'zlib';
  signal?: AbortSignal;
}

interface DecodeOptions {
  password?: Password;
  signal?: AbortSignal;
}

declare function encode(document: SnifDocument, options?: EncodeOptions): Promise<Uint8Array>;
declare function decode(data: Uint8Array, options?: DecodeOptions): Promise<SnifDocument>;
declare function inspect(data: Uint8Array): SnifHeader;
```

`SnifDocument`、`SnifHeader`および以下のexported TypeScript型は、本節を正本とする。byte stringは`Uint8Array`で表し、正確なbyte長、全ゼロ禁止およびchainとの組合せは本文5章の規則に従う。型だけでbyte長を保証してはならない。

```ts
type Chain = 'symbol' | 'nem';
type ConnectionPermission = 'account' | 'sign-transaction' | 'sign-message';
type SymbolNetwork = { id: number; generationHashSeed: Uint8Array };
type NemNetwork = { id: number };
type Network = SymbolNetwork | NemNetwork;
type EncryptionHeader = { algorithm: 'none' } | { algorithm: 'password-v1'; salt: Uint8Array; nonce: Uint8Array };

type RequestContext = {
  requestId: Uint8Array;
  createdAt: number;
  expiresAt: number;
  audience: string;
};
type ConnectionProof = { sessionId: Uint8Array; requesterPublicKey: Uint8Array; signature: Uint8Array };
type AccountReference = { address: Uint8Array; publicKey: Uint8Array };
type ApplicationMetadata = { name: string; origin: string; iconUrl?: string };

type ContactPayload = { name: string; address: Uint8Array; publicKey?: Uint8Array };
type AddressPayload = { address: Uint8Array };
type AccountPayload = { privateKey: Uint8Array; publicKey: Uint8Array; address: Uint8Array };
type MnemonicPayload = {
  scheme: 'bip39';
  language:
    | 'english'
    | 'japanese'
    | 'korean'
    | 'spanish'
    | 'chinese-simplified'
    | 'chinese-traditional'
    | 'french'
    | 'italian'
    | 'czech'
    | 'portuguese';
  mnemonic: string;
  passphrase?: string;
};
type SignRequestPayload = {
  transactionPayload: Uint8Array;
  signingType: 'transaction' | 'cosignature';
  context: RequestContext;
  expectedSignerPublicKey?: Uint8Array;
  connection?: ConnectionProof;
};
type SignedTransactionPayload = { transactionPayload: Uint8Array; requestId?: Uint8Array };
type MessageSignRequestPayload = {
  message: Uint8Array;
  purpose: string;
  context: RequestContext;
  expectedSignerPublicKey?: Uint8Array;
  connection?: ConnectionProof;
};
type DetachedSignaturePayload =
  | {
      signatureType: 'transaction' | 'message';
      signature: Uint8Array;
      signerPublicKey: Uint8Array;
      targetHash: Uint8Array;
      requestId: Uint8Array;
    }
  | { signatureType: 'rejected'; requestId: Uint8Array };
type SymbolSignaturePayload =
  | DetachedSignaturePayload
  | {
      signatureType: 'cosignature';
      parentHash: Uint8Array;
      signature: Uint8Array;
      signerPublicKey: Uint8Array;
      version: 0;
      requestId: Uint8Array;
    };
type NemSignaturePayload =
  DetachedSignaturePayload | { signatureType: 'cosignature'; transactionPayload: Uint8Array; requestId: Uint8Array };
type ConnectionRequestPayload = {
  application: ApplicationMetadata;
  permissions: ConnectionPermission[];
  challenge: Uint8Array;
  context: RequestContext;
  requesterPublicKey: Uint8Array;
  signature: Uint8Array;
};
type ConnectionResponsePayload =
  | { approved: false; requestId: Uint8Array }
  | {
      approved: true;
      requestId: Uint8Array;
      sessionId: Uint8Array;
      sessionCreatedAt: number;
      sessionExpiresAt: number;
      account: AccountReference;
      permissions: ConnectionPermission[];
      signature: Uint8Array;
    };

type PayloadByType = {
  contact: ContactPayload;
  address: AddressPayload;
  account: AccountPayload;
  mnemonic: MnemonicPayload;
  'sign-request': SignRequestPayload;
  'signed-transaction': SignedTransactionPayload;
  'message-sign-request': MessageSignRequestPayload;
  signature: never;
  'connection-request': ConnectionRequestPayload;
  'connection-response': ConnectionResponsePayload;
};
type FormatType = keyof PayloadByType;
type NetworkByChain = { symbol: SymbolNetwork; nem: NemNetwork };
type PayloadFor<T extends FormatType, C extends Chain> = T extends 'signature'
  ? C extends 'symbol'
    ? SymbolSignaturePayload
    : NemSignaturePayload
  : PayloadByType[T];
type SnifDocument = {
  [T in FormatType]: {
    [C in Chain]: { type: T; chain: C; network: NetworkByChain[C]; payload: PayloadFor<T, C> };
  }[Chain];
}[FormatType];
type SnifHeader = {
  [C in Chain]: {
    protocol: 'snif';
    version: 1;
    type: FormatType;
    chain: C;
    network: NetworkByChain[C];
    compression: 'none' | 'zlib';
    encryption: EncryptionHeader;
  };
}[Chain];
```

`SnifDocument`は`type`を判別fieldとするv1の10 payload typeのdiscriminated unionとする。`chain`、`network`、`payload`を必須とし、payloadはtype固有CDDL mapと同じfield名・必須性を持つ。`network`は`chain: 'symbol'`で`SymbolNetwork`、`chain: 'nem'`で`NemNetwork`だけを許可する。公開型が表す組合せに加え、適合実装はruntime validationを省略してはならない。

`signatureType: 'cosignature'`の最初のbranchはSymbol、2番目のbranchはNEMだけで許可する。秘密payloadである`AccountPayload`と`MnemonicPayload`を`decode`が返した時点で、各`Uint8Array`および文字列に含まれる秘密情報の所有権と消去責任は呼び出し側へ移る。その他のpayloadに秘密情報がないことをcodecは保証しない。

`SnifHeader`は外側エンベロープだけを表す。payload、復号結果、またはpayloadが検証済みであることを示すfieldを含めてはならない。

- `encode`はpayload validation、決定的CBOR、圧縮、暗号化、エンベロープCBORを順番に実行する。外部storageを読み書きしてはならない。
- `decode`は8.1節のcodec検証を完了してからdocumentを返す。返却documentは構文、field形状、正規化、長さ、列挙値、リソース上限および暗号認証を満たすが、元要求、現在時刻、署名、chain意味、origin、permission、connection、replayまたは搬送路の認証は未実施である。これを認可済みまたは署名要求との対応確認済みとして扱ってはならない。
- `signal`による中断は`operation-cancelled`とする。暗号処理開始後も可能な最短の安全な境界で中断し、6.5節の消去を実行する。
- `compression`の既定値は`auto`とする。`auto`は`account`と`mnemonic`で必ず`none`、ほかのtypeではzlib結果が元CBORより短い場合だけ`zlib`を選択する。秘密typeへ明示的に`zlib`を指定した場合は`invalid-envelope`とする。
- `account`と`mnemonic`のencodeではpasswordを必須とし、未指定なら`password-required`とする。暗号化データのdecodeでpasswordが未指定なら`password-required`、誤passwordなら`decryption-failed`とする。
- OS CSPRNGが利用不能、失敗、または要求した長さを返さない場合、処理を中断して`entropy-unavailable`を返す。固定値、時刻、非暗号学的乱数へのfallbackを禁止する。
- `inspect`は外側エンベロープだけをstrictに検証し、payloadを復号・展開せずheaderを返す。返却値をpayloadが正しい証拠として使用してはならない。
- 入力`Uint8Array`を無断で変更しない。内部copyは6.5節に従って消去する。返却された秘密payloadの所有権と消去責任は呼び出し側へ移る。

### 11.3 エラー型

```ts
type SnifErrorCode =
  | 'invalid-envelope'
  | 'unsupported-version'
  | 'unsupported-type'
  | 'unsupported-codec'
  | 'password-required'
  | 'decryption-failed'
  | 'resource-limit'
  | 'operation-cancelled'
  | 'entropy-unavailable'
  | 'invalid-payload'
  | 'invalid-context';

declare class SnifError extends Error {
  readonly code: SnifErrorCode;
}
```

## 12. 実装チェックリスト

実装は次の独立コンポーネントへ分けて着手できる。

1. 厳格な決定的CBOR encoder/decoder
2. エンベロープ解析とheader/AAD構築
3. 上限付きzlib圧縮・展開
4. `password-v1`暗号化プロファイル
5. フォーマットタイプごとの構造validator
6. 公開encode/decode境界での適合fixture実行

通常codec APIは外部状態を変更せず、搬送処理と暗号処理をinterfaceの背後に分離する。browser、Node.js、mobile、hardware wallet、offline実装で同じスキーマと検証動作を共有し、状態管理を必要としない利用を妨げてはならない。

## 13. TypeScript推奨実装（非規範）

本章はTypeScript参照実装の依存パッケージを統一するための非規範ガイドであり、ワイヤ適合性は使用ライブラリではなく、本文と10章のfixtureによって判定する。別言語またはplatform nativeの実装は、同じ結果を生成できれば別ライブラリを使用してよい。

初期TypeScript実装では、次の組み合わせを推奨する。

| 処理        | 推奨パッケージ／API                                                           | 選定理由と要件                                                                                              |
| ----------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Argon2id    | [`@noble/hashes`](https://github.com/paulmillr/noble-hashes)の`argon2idAsync` | pure JavaScriptでbrowserとNode.jsを共通化できる。全KDFパラメーターを明示し、非同期APIを使用する             |
| AES-256-GCM | [`@noble/ciphers`](https://github.com/paulmillr/noble-ciphers)の`gcm`         | browserとNode.jsで同じ結果を得られ、AADを明示できる。ciphertextの後ろにtagが続く返却形式をfixtureで固定する |
| zlib        | [`fflate`](https://github.com/101arrowz/fflate)のzlib専用API                  | 小さなpure JavaScript実装でbrowserとNode.jsを共通化でき、streaming APIを利用できる                          |
| CBOR        | [`cborg`](https://github.com/rvagg/cborg)のbase API                           | RFC 8949 map順、strict decode、重複key拒否を構成できる                                                      |

本リポジトリで確認済みの初期baselineは`@noble/hashes` 2.2.0、`@noble/ciphers` 2.2.0、`fflate` 0.8.3、`cborg` 6.1.1である。実装パッケージはこれらをdirect dependencyとして宣言し、lockfileで解決versionとintegrityを固定する。将来versionを更新する場合は、暗号化・圧縮・CBORを含む全適合fixtureを再実行しなければならない。

既存の`@nemnesia/simple-password-crypto`はKDFパラメーター、AAD、暗号文エンベロープがSNIF `password-v1`と異なるため、その出力をSNIFへ直接格納してはならない。内部primitiveを共有する場合も、SNIF専用adapterで6章の処理とbyte配置を実装し、適合fixtureで検証する。

`fflate`ではformat自動判定APIを使用せず、zlib専用の`zlibSync`／`Zlib`と`unzlibSync`／`Unzlib`だけを使用する。展開側は出力chunkの累積長を受け取るたびに検査し、16 MiBを超えた時点で中断する。使用APIがzlib stream後の余分なbyteを拒否することも負のfixtureで確認し、拒否できない場合はwrapperで検出する。

Argon2idはCPU・memory負荷が大きいため、公式実装はJavaScript runtimeごとに実行中KDFを1件、待機queueを1件に制限する。3件目は処理を開始せず`resource-limit`とし、この上限を変更する公開optionを設けてはならない。browserでは内部のmodule Workerを遅延生成して再利用し、main thread上でArgon2idを実行してはならない。公式実装の対応platformごとに、65,536 KiBのmemory確保失敗、利用者cancel、queue上限超過をテストし、`resource-limit`または`operation-cancelled`へ変換して秘密bufferを消去する。platform nativeまたはWASM実装へ差し替える場合も、6.2節の全パラメーター、password byte列、salt、出力鍵がfixtureとbyte-for-byteで一致しなければならない。

baseline時点の`@noble/hashes`文書では、過去の第三者audit範囲にArgon2実装が含まれていないことが明記されている。このため、採用理由を可搬性と実装統一性に限定し、「第三者audit済みArgon2」と表現してはならない。安定版の公開前に、対象versionのsecurity review状況を再確認し、必要に応じてadapterの背後でreview済みのplatform nativeまたはWASM実装へ交換する。

ライブラリAPIへ渡したbufferも6.5節の消去対象である。ライブラリが内部コピーの消去を保証しない場合、呼び出し側が所有する入力・出力・一時bufferを消去し、保証範囲をAPI文書へ記載する。
