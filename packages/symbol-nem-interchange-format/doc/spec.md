# Symbol NEM Interchange Format (SNIF) v1

ステータス: Draft 1

ワイヤバージョン: `1`

## 1. 目的と適用範囲

Symbol NEM Interchange Format（SNIF）は、SymbolおよびNEMのデータをアプリケーションや端末間で交換するための、搬送手段に依存しないバイナリ形式である。公開アカウント情報、秘密情報のバックアップ、トランザクションおよびメッセージへの署名、ウォレット権限のネゴシエーションを対象とする。

本仕様は、1件の完全なSNIFバイト列までを定義する。そのバイト列をQRコード、Animated QR、ファイル、NFCレコード、Deep Linkなどへ格納する方法は、別途定義する搬送プロファイルの責務とする。分割、再構成、URIスキーム、搬送時のテキストエンコードはv1の対象外である。

### 1.1 規範用語

**必須**、**禁止**、**推奨**、**非推奨**、**任意**は規範的な要件を表す。実装がv1に適合するには、次のすべてを満たさなければならない。

- 対応するタイプについて、正しいv1データを受理する。
- 決定的にエンコードされたCBORを生成する。
- アプリケーションへデータを返す前に不正な入力を拒否する。
- 本仕様の検証規則とリソース上限を実装する。

実装が対応するフォーマットタイプは一部のみでもよい。ただし、未対応タイプを明示的に報告し、別タイプとして解釈してはならない。

### 1.2 用語

| 用語               | 意味                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| エンベロープ       | ルーティング、コーデック、ネットワークのメタデータを持つ外側CBOR map |
| 内部ペイロード     | 圧縮・暗号化前のタイプ固有CBOR map                                   |
| 処理済みペイロード | `envelope.payload`へ格納するバイト列                                 |
| ヘッダー           | エンベロープから`payload`ペアを除いたmap                             |
| 診断用JSON         | 説明用の可読表現。ワイヤ表現ではない                                 |

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

- 文字列はUnicode NFC形式の正しいUTF-8とする。
- 表示用文字列ではU+0000〜U+001FおよびU+007Fを禁止する。
- 空文字列を禁止する。
- 暗号値、アドレス、識別子、シリアライズ済みトランザクションは、hexやBase64文字列ではなくCBOR byte stringを使用する。
- 本文記載のバイト長は厳密な長さを表す。

受信側はNFC形式を検証し、受信文字列を暗黙に正規化してはならない。パスワードだけは例外とし、6章の規則に従って正規化せず扱う。

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
| `origin` and `iconUrl`           |  2,048 UTF-8 bytes |
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

| チェーン |     長さ | 検証                                                |
| -------- | -------: | --------------------------------------------------- |
| Symbol   | 24 bytes | ネットワークbyte、本体、3-byte checksumが正しいこと |
| NEM      | 25 bytes | ネットワークbyte、本体、4-byte checksumが正しいこと |

アドレスの先頭byteは`network.id`と一致しなければならない。UIは大文字Base32の正規表現で表示し、入力時にハイフンを許容してもよいが、ワイヤ値は常にデコード済みbyte stringとする。

### 4.2 鍵、ハッシュ、署名

| 値               |     長さ |
| ---------------- | -------: |
| 秘密鍵           | 32 bytes |
| 公開鍵           | 32 bytes |
| SHA3-256ハッシュ | 32 bytes |
| Ed25519系署名    | 64 bytes |

全byteがゼロの公開鍵、秘密鍵、ハッシュ、署名は不正とする。公開鍵は対象チェーンの規則上正しい鍵でなければならない。導出関係にある値が同時に存在する場合、受信側は再計算して比較しなければならない。

本仕様におけるSHA3-256は[FIPS 202](https://csrc.nist.gov/pubs/fips/202/final)のSHA3-256を意味し、Ethereumで通称Keccak-256と呼ばれる関数を意味しない。

### 4.3 トランザクション

`transactionPayload`は対象チェーンが定義する完全なシリアライズ済みトランザクションである。トランザクションをちょうど1件含み、チェーン形式にサイズフィールドがある場合はその値が正しく、エンベロープと同じネットワークを使用し、末尾に余分なbyteを持たないことを必須とする。

SNIFはSymbolまたはNEMのトランザクション形式、トランザクションハッシュ、署名アルゴリズムを再定義しない。実装は対象チェーンのプロトコル規則を使用しなければならない。Symbol署名ではエンベロープのgeneration hash seedを署名コンテキストとし、アプリケーションが想定するネットワークと一致させる。

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

BIP39復元フレーズと、対象アカウントを再現するための派生パスを格納する。`encryption.algorithm`は`password-v1`を必須とする。

```cddl
mnemonic-payload = {
  "scheme": "bip39",
  "language": bip39-language,
  "mnemonic": text .size (1..1024),
  ? "passphrase": text .size (0..1024),
  "derivationPaths": [1*32 derivation-path],
}

bip39-language =
  "english" / "japanese" / "korean" /
  "spanish" / "chinese-simplified" /
  "chinese-traditional" / "french" /
  "italian" / "czech" / "portuguese"

derivation-path = text .size (1..128)
```

ニーモニックは`language`に対応するBIP39単語リストとchecksumの検証に合格しなければならない。単語間はASCII space 1文字とし、日本語でもワイヤ値にはASCII spaceを使用する。`passphrase`はBIP39のpassphraseそのもので、存在する場合は空でもよい。UIの暗号化パスワードとは別物である。

各派生パスは`m/44'/4343'/0'/0'/0'`のような正規の絶対表記を使用する。文法は正規表現`^m(?:/(?:0|[1-9][0-9]{0,9})'?){1,10}$`に一致し、各indexは0〜2,147,483,647とする。`'`はhardened derivationを表す。先頭ゼロ、空segment、末尾slash、空白を禁止する。重複パスは禁止する。ウォレット固有の既定値には相互運用性がないため、SNIFでは派生パスを明示的に保存する。

```json
{
  "scheme": "bip39",
  "language": "english",
  "mnemonic": "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
  "derivationPaths": ["m/44'/4343'/0'/0'/0'"]
}
```

### 5.5 トランザクション署名要求: `sign-request`

通常のトランザクション署名または連署を要求する。

```cddl
sign-request-payload = {
  "transactionPayload": bstr .size (1..8388608),
  "signingType": "transaction" / "cosignature",
  ? "expectedSignerPublicKey": bstr .size 32,
  ? "requestId": request-id,
}
```

`transaction`では、対象トランザクションがチェーン規則上署名可能な状態でなければならない。`cosignature`では、対象チェーンが想定署名者による連署を許可するトランザクションでなければならない。ウォレットは承認を求める前にトランザクションを解析・表示し、正しいCBORに格納されているという理由だけで不透明なbyte列へ署名してはならない。

`expectedSignerPublicKey`が存在する場合、ウォレットはその鍵でのみ署名できる。`requestId`は対応付け用メタデータであり、要求元の証明として信頼してはならない。

### 5.6 署名済みトランザクション: `signed-transaction`

1件以上の署名が追加された完全なトランザクションを格納する。

```cddl
signed-transaction-payload = {
  "transactionPayload": bstr .size (1..8388608),
  ? "requestId": request-id,
}
```

トランザクションは追加連署を必要としてもよいが、格納済みの署名はすべて検証に成功しなければならない。`requestId`が存在する場合は元の要求IDと一致させる。

### 5.7 メッセージ署名要求: `message-sign-request`

任意のbyte列に対するドメイン分離済み署名を要求する。

```cddl
message-sign-request-payload = {
  "message": bstr .size (0..1048576),
  "purpose": text .size (1..256),
  ? "expectedSignerPublicKey": bstr .size 32,
  ? "requestId": request-id,
}
```

対象チェーンの署名処理へ渡す正確なbyte列を次のように定義する。

```text
UTF8("SNIF-MESSAGE\u0000") || uint32be(byteLength(purpose)) || UTF8(purpose) || message
```

`purpose`はNFC形式のUTF-8とし、長さprefixはUTF-8のbyte数を表す。このフレーミングは必須であり、v1では未フレームの生メッセージへの署名を要求できない。ウォレットは承認前にpurposeとメッセージの安全な表現を表示しなければならない。

```json
{
  "message": "hex:4C6F67696E206368616C6C656E67653A20616263313233",
  "purpose": "authentication",
  "requestId": "hex:00112233445566778899AABBCCDDEEFF"
}
```

### 5.8 署名結果: `signature`

完全なトランザクションを再構築せず、署名1件を格納する。

```cddl
signature-payload = {
  "signatureType": "transaction" / "cosignature" / "message",
  "signature": bstr .size 64,
  "signerPublicKey": bstr .size 32,
  "targetHash": bstr .size 32,
  ? "requestId": request-id,
}
```

`targetHash`は`signatureType`ごとに次のように定義する。

| タイプ        | `targetHash`                                                      |
| ------------- | ----------------------------------------------------------------- |
| `transaction` | チェーンが定義する正確な署名対象byte列のSHA3-256                  |
| `cosignature` | 親Aggregateまたはマルチシグトランザクションのチェーン定義ハッシュ |
| `message`     | 5.7節でフレーム化したbyte列のSHA3-256                             |

受信側は元の要求コンテキストから`targetHash`を再計算し、署名を検証しなければならない。`requestId`の一致だけでは不十分である。

### 5.9 ウォレット接続要求: `connection-request`

ウォレットに対し、情報開示と利用権限を要求する。アプリケーションメタデータは自己申告の表示情報であり、認証済みIDではない。

```cddl
connection-request-payload = {
  "application": application,
  "permissions": [1*3 permission],
  "requestId": request-id,
  ? "expiresAt": uint,
}

application = {
  "name": text .size (1..128),
  "origin": text .size (1..2048),
  ? "iconUrl": text .size (1..2048),
}

permission = "account" / "sign-transaction" / "sign-message"
```

`permissions`は重複を含まず、`account`を必ず含まなければならない。`sign-transaction`と`sign-message`は、選択アカウントの公開を前提とする追加権限である。`requestId`には16-byteの乱数を使用することを推奨する。`expiresAt`は秒単位のUnix timestampであり、指定時刻以後は要求を拒否する。24時間より先の有効期限は不審な要求として扱うことを推奨する。

コアデコーダーは`origin`と`iconUrl`を取得も信頼もしない。ホストアプリケーションがアイコンを取得する場合は、追跡、SSRF、過大コンテンツ、安全でないメディアへの対策を必須とする。搬送路から検証可能なoriginを得られる場合は、自己申告originと比較することを推奨する。

### 5.10 ウォレット接続応答: `connection-response`

1件の接続要求に対する承認または拒否を返す。

```cddl
connection-response-payload = approved-response / rejected-response

approved-response = {
  "approved": true,
  "account": public-account,
  "permissions": [1*3 permission],
  "requestId": request-id,
}

rejected-response = {
  "approved": false,
  "requestId": request-id,
}

public-account = {
  "address": chain-address,
  "publicKey": bstr .size 32,
}
```

応答のネットワークと`requestId`は要求と一致しなければならない。承認権限は、`account`を含み、要求権限のうち重複のない部分集合とする。公開鍵、アドレス、エンベロープのネットワークは互いに整合しなければならない。拒否応答はアカウントも権限も開示してはならない。

SNIF接続メッセージは、認証済みセッション、搬送路セキュリティ、replay防止、capability tokenを確立しない。権限状態の保持と後続要求の認証はホストアプリケーションの責務である。後続操作は毎回その状態と照合しなければならない。

### 5.11 共通CDDL定義

```cddl
chain-address = symbol-address / nem-address
symbol-address = bstr .size 24
nem-address = bstr .size 25
request-id = bstr .size (16..64)
```

エンベロープのchainによって`chain-address`の分岐を決定する。Symbolエンベロープに25-byteのNEMアドレスを格納すること、およびその逆を禁止する。

## 6. パスワード暗号化プロファイル

### 6.1 適用条件

`password-v1`はワイヤバージョン1で唯一の暗号化プロファイルである。`account`と`mnemonic`では必須とし、ほかのタイプでも使用してよい。公開鍵暗号は将来プロファイル用に予約する。

暗号処理の実装は独立したパッケージまたはモジュール境界へ分離することを推奨する。この分離によって以下のワイヤアルゴリズムは変化しない。

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

本節の秘密情報には、パスワード、秘密鍵、ニーモニック、BIP39 passphrase、導出鍵、およびそれらを含む未暗号化のCBOR・圧縮前後の一時bufferを含む。

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

エンコーダーは、圧縮処理を含めても処理済みペイロード全体が小さくなる場合に限りzlibを選択することを推奨する。デコーダーはstream処理などで展開出力を16 MiBに制限し、超過時は即座に中断し、zlib stream後の余分なbyteを拒否しなければならない。

圧縮は暗号化より前に行う。攻撃者制御データと秘密文字列が同じペイロードに存在すると圧縮率から情報が漏れる可能性があるため、秘密ペイロードでは通常`none`を推奨する。

## 8. 検証とエラー

### 8.1 検証順序

受信側は次の順序で検証しなければならない。

1. 搬送手段から得られるbyte長（判明している場合）
2. 外側CBORの構文、決定性、重複キー、リソース上限
3. protocol、version、列挙値、エンベロープフィールド型、chain/network整合性
4. 暗号化プロファイルの形と処理済みペイロード長
5. 認証と復号
6. 展開と展開後サイズ
7. 内部CBORの構文、決定性、厳密なスキーマ、リソース上限
8. タイプ固有の暗号値、トランザクション、要求・応答整合性

いずれかが失敗した場合、受信側は部分的にデコードしたペイロードを返してはならない。UIは利用者向け表現へ変換してもよいが、logへパスワード、秘密鍵、ニーモニック、復号済みペイロード、署名対象challenge全体を出力してはならない。

### 8.2 エラーカテゴリー

実装はparser固有メッセージではなく、次の安定したカテゴリーを公開することを推奨する。

| カテゴリー            | 意味                                                       |
| --------------------- | ---------------------------------------------------------- |
| `invalid-envelope`    | 外側CBORまたはスキーマが不正・非決定的                     |
| `unsupported-version` | `protocol`はSNIFだが`version`が未対応                      |
| `unsupported-type`    | SNIF versionは正しいがtypeが未実装                         |
| `unsupported-codec`   | 圧縮または暗号化プロファイルが未対応                       |
| `decryption-failed`   | パスワード、ciphertext、認証の失敗                         |
| `resource-limit`      | 宣言値または生成値が上限超過                               |
| `invalid-payload`     | 内部CBORまたはタイプ固有スキーマが不正                     |
| `network-mismatch`    | アドレス、鍵、トランザクション、応答がエンベロープと不一致 |
| `verification-failed` | ハッシュ、署名、鍵導出、checksumが不一致                   |

実装はローカル診断情報を付加してもよいが、暗号処理の詳細な失敗理由をtrust boundaryの外へ公開してはならない。

## 9. バージョニングと拡張方針

ワイヤバージョン`1`は厳格に解釈する。v1エンコーダーは本仕様のフィールドと列挙値だけを出力する。v1デコーダーは未知フィールドを破棄・保持せず拒否しなければならない。

フィールドの意味、署名対象byte列、暗号処理、許容値を変える場合、新しいワイヤバージョンまたは名前付きcodec profileを必要とする。将来仕様で最上位format typeを追加してもよいが、旧実装は`unsupported-type`を返し、推測してはならない。

搬送プロファイルは不透明な完全SNIFバイト列を扱うため、コア仕様から独立して発展してよい。

## 10. 適合テストベクトル

Draft 1を安定版へ昇格する前に、本仕様から生成した機械可読な適合fixtureをリポジトリへ追加しなければならない。各fixtureは次を含む。

- 診断用入力値
- 内部ペイロードの決定的CBOR（16進）
- 完全なエンベロープの決定的CBOR（16進）
- 期待デコード値または期待エラーカテゴリー
- 暗号化ケースではテスト専用の固定password、salt、nonce、導出鍵、AAD、ciphertext、authentication tag

最低限のfixture matrixを次に示す。

| 対象     | 必須ケース                                                    |
| -------- | ------------------------------------------------------------- |
| タイプ   | 許容される各タイプについて正しい平文fixture 1件               |
| チェーン | SymbolとNEMのアドレスおよびトランザクション各1件以上          |
| 暗号化   | 正しいaccountとmnemonic、誤パスワード、header改変、tag改変    |
| 圧縮     | 正しいzlib、raw-DEFLATE拒否、末尾データ拒否、展開上限         |
| CBOR     | 非最短整数、不定長、重複キー、誤ったキー順、末尾item          |
| 整合性   | 鍵・アドレス不一致、network不一致、request ID不一致、過剰権限 |
| 署名     | transaction、cosignature、domain-separated messageの検証      |

適合には、エンコードfixtureとのbyte-for-byte一致、および全不正fixtureを指定カテゴリーで拒否することを必要とする。fixture生成器を独立したプロトコル規則の情報源としてはならず、不一致時は本文を正とする。

## 11. 実装チェックリスト

実装は次の独立コンポーネントへ分けて着手できる。

1. 厳格な決定的CBOR encoder/decoder
2. エンベロープ解析とheader/AAD構築
3. 上限付きzlib圧縮・展開
4. `password-v1`暗号化プロファイル
5. チェーン固有のアドレス、鍵、トランザクション、ハッシュ、署名検証
6. フォーマットタイプごとのvalidator
7. 公開encode/decode境界での適合fixture実行

コアAPIは搬送処理と暗号処理をinterfaceの背後に分離し、browser、Node.js、mobile、hardware wallet、offline実装で同じスキーマと検証動作を共有できる構造を推奨する。
