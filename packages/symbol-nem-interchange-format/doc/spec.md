# Symbol NEM Interchange Format（SNIF）

SymbolおよびNEMで使用する各種データを、アプリケーションや端末間で保存・交換するための共通データフォーマット。

SNIFはQRコードに限定されない。QRコード、Animated QR、ファイル、NFC、Deep Linkなど、複数の搬送手段で利用できる。

## データ形式

SNIFでは、各フォーマットのデータ構造をJSON形式で定義し、実際の保存および転送には、JSONデータをCBORでエンコードしたバイナリデータを使用する。

基本的な処理順序は次のとおりとする。

```text
JSONデータ構造
    ↓
CBORエンコード
    ↓
必要に応じて圧縮
    ↓
必要に応じて暗号化
    ↓
QRコード、ファイル、NFCなどで転送
```

暗号化と圧縮を併用する場合は、必ず圧縮後に暗号化する。

```text
CBORエンコード
    ↓
圧縮
    ↓
暗号化
```

## フォーマットタイプ

SNIFでは、次のフォーマットタイプを定義する。

| タイプ                   | 識別子                 | 用途                                                   |
| ------------------------ | ---------------------- | ------------------------------------------------------ |
| 連絡先                   | `contact`              | 名前、アドレス、公開鍵の受け渡し                       |
| アドレス                 | `address`              | アドレスの提示                                         |
| アカウント               | `account`              | 秘密鍵を含むアカウント情報のバックアップ               |
| ニーモニック             | `mnemonic`             | ニーモニックのバックアップ                             |
| 署名要求                 | `sign-request`         | トランザクションへの署名または連署の要求               |
| 署名済みトランザクション | `signed-transaction`   | 署名後のトランザクションの受け渡し                     |
| メッセージ署名要求       | `message-sign-request` | 任意メッセージへの署名要求                             |
| 署名                     | `signature`            | トランザクション署名、連署、メッセージ署名の受け渡し   |
| ウォレット接続要求       | `connection-request`   | dAppからウォレットへの接続と権限の要求                 |
| ウォレット接続応答       | `connection-response`  | 接続要求の承認結果と公開可能なアカウント情報の受け渡し |

### 連絡先

名前、アドレス、公開鍵を受け渡すために使用する。

公開鍵は任意項目とする。アカウントの公開鍵がブロックチェーン上で公開されていない場合でも、アドレスのみで連絡先を登録できる。

`contact`は単なる公開情報の受け渡しであり、ウォレットへの接続承認や権限付与を意味しない。

### アドレス

送金先などのアドレスを単独で提示するために使用する。

### アカウント

秘密鍵を含む単一アカウントのバックアップに使用する。

このフォーマットは秘密情報を含むため、暗号化を必須とする。

### ニーモニック

ウォレットの復元に使用するニーモニックを保存する。

このフォーマットは秘密情報を含むため、暗号化を必須とする。

### 署名要求

未署名トランザクション、または追加署名が必要なトランザクションを署名端末へ渡すために使用する。

通常のトランザクション署名に加え、SymbolのAggregate TransactionやNEMのマルチシグトランザクションに対する連署も含む。

### 署名済みトランザクション

署名後のトランザクション全体を受け渡すために使用する。

一部の連署のみが付与されたトランザクションや、すべての連署が完了したトランザクションも、この形式に含める。

### メッセージ署名要求

任意のメッセージまたはバイナリデータを署名端末へ渡し、署名を要求するために使用する。

ログイン認証、アカウント所有証明、任意データの真正性確認など、トランザクションを伴わない署名処理を対象とする。

### 署名

トランザクション全体ではなく、署名または連署データのみを受け渡すために使用する。

トランザクション署名、連署、メッセージ署名の結果を共通の形式で格納する。

署名値だけでは署名対象を識別できないため、署名対象のハッシュや署名者公開鍵なども格納する。

### ウォレット接続要求

dAppがウォレットに対し、接続元の情報と必要な権限を提示して接続を要求するために使用する。

接続対象のチェーンとネットワークは共通エンベロープの`chain`および`network`で指定し、ペイロード内には重複して格納しない。

### ウォレット接続応答

ウォレットが接続要求に対する承認結果を返すために使用する。

承認時は公開可能なアカウント情報と付与した権限を返す。これは対応する接続要求への明示的な権限付与であり、`contact`とは異なる。

## 共通エンベロープ

すべてのSNIFデータは、共通エンベロープを持つ。

### 標準項目

| 項目                           | JSONキー                     |       必須 | 説明                                         |
| ------------------------------ | ---------------------------- | ---------: | -------------------------------------------- |
| プロトコル識別子               | `protocol`                   |       必須 | SNIFデータであることを示す                   |
| フォーマットバージョン         | `version`                    |       必須 | SNIF共通エンベロープのバージョン             |
| フォーマットタイプ             | `type`                       |       必須 | 格納されているデータの種類                   |
| ブロックチェーン               | `chain`                      |       必須 | `nem`または`symbol`                          |
| ネットワークID                 | `network.id`                 |       必須 | 対象ネットワークの識別子                     |
| ジェネレーションハッシュシード | `network.generationHashSeed` | Symbolのみ | Symbolネットワークの識別および署名に使用する |
| 暗号化方式                     | `options.encryption`         |       必須 | 暗号化しない場合は`none`                     |
| 圧縮方式                       | `options.compression`        |       必須 | 圧縮しない場合は`none`                       |
| ペイロード                     | `payload`                    |       必須 | フォーマットタイプ固有のデータ               |

### 共通エンベロープ例

```json
{
  "protocol": "SNIF",
  "version": 1,
  "type": "sign-request",
  "chain": "symbol",
  "network": {
    "id": 152,
    "generationHashSeed": "57F7DA20..."
  },
  "options": {
    "encryption": "none",
    "compression": "none"
  },
  "payload": {}
}
```

NEMでは、`generationHashSeed`を省略する。

```json
{
  "protocol": "SNIF",
  "version": 1,
  "type": "address",
  "chain": "nem",
  "network": {
    "id": 152
  },
  "options": {
    "encryption": "none",
    "compression": "none"
  },
  "payload": {}
}
```

## フォーマット詳細

### 連絡先：`contact`

名前付きのアドレス情報を格納する。

#### ペイロード

| 項目        | 必須 | 説明                      |
| ----------- | ---: | ------------------------- |
| `name`      | 必須 | 連絡先名                  |
| `address`   | 必須 | NEMまたはSymbolのアドレス |
| `publicKey` | 任意 | アカウントの公開鍵        |

```json
{
  "name": "nemtech",
  "address": "TAC5EWBFKGBCE7TFVEE4UTLAYUT4P4PYI7GO4GA",
  "publicKey": "B101CC4B46B5C7B1D7DF50D1EB60C19FF4B2E2D91F790DB3660D6321ACF1719B"
}
```

### アドレス：`address`

アドレスのみを提示するために使用する。

#### ペイロード

| 項目      | 必須 | 説明                      |
| --------- | ---: | ------------------------- |
| `address` | 必須 | NEMまたはSymbolのアドレス |

```json
{
  "address": "TAC5EWBFKGBCE7TFVEE4UTLAYUT4P4PYI7GO4GA"
}
```

### アカウント：`account`

秘密鍵を含むアカウント情報を格納する。

暗号化を必須とする。

#### ペイロード

| 項目         | 必須 | 説明                         |
| ------------ | ---: | ---------------------------- |
| `privateKey` | 必須 | アカウント秘密鍵             |
| `publicKey`  | 必須 | 秘密鍵から導出される公開鍵   |
| `address`    | 必須 | 公開鍵から導出されるアドレス |

公開鍵とアドレスは秘密鍵から再計算し、復号後の整合性検証に使用する。

```json
{
  "address": "TAC5EWBFKGBCE7TFVEE4UTLAYUT4P4PYI7GO4GA",
  "publicKey": "B101CC4B46B5C7B1D7DF50D1EB60C19FF4B2E2D91F790DB3660D6321ACF1719B",
  "privateKey": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
}
```

### ニーモニック：`mnemonic`

ウォレット復元用のニーモニックを格納する。

暗号化を必須とする。

#### ペイロード

| 項目       | 必須 | 説明                 |
| ---------- | ---: | -------------------- |
| `mnemonic` | 必須 | ニーモニックの単語列 |
| `language` | 推奨 | ニーモニックの言語   |

ニーモニック規格およびアカウントの派生パスは、チェーンとネットワークごとに決定されるため格納しない。

```json
{
  "mnemonic": "word1 word2 word3 ...",
  "language": "english"
}
```

### 署名要求：`sign-request`

署名対象となるトランザクションを格納する。

#### ペイロード

| 項目                      | 必須 | 説明                                                                           |
| ------------------------- | ---: | ------------------------------------------------------------------------------ |
| `transactionPayload`      | 必須 | 未署名または追加署名対象のトランザクション                                     |
| `signingType`             | 推奨 | 通常署名または連署の区別                                                       |
| `expectedSignerPublicKey` | 任意 | 想定する署名者の公開鍵                                                         |
| `requestId`               | 任意 | 署名要求と署名結果の対応付けなど、アプリケーション側の状態管理に使用する識別子 |

`signingType`には、次の値を使用する。

- `transaction`
- `cosignature`

```json
{
  "transactionPayload": "00000000...",
  "signingType": "transaction",
  "expectedSignerPublicKey": "B101CC4B46B5C7B1D7DF50D1EB60C19FF4B2E2D91F790DB3660D6321ACF1719B",
  "requestId": "018F4D7C..."
}
```

### 署名済みトランザクション：`signed-transaction`

署名済みのトランザクション全体を格納する。

#### ペイロード

| 項目                 | 必須 | 説明                     |
| -------------------- | ---: | ------------------------ |
| `transactionPayload` | 必須 | 署名済みトランザクション |

```json
{
  "transactionPayload": "00000000..."
}
```

### メッセージ署名要求：`message-sign-request`

任意のメッセージまたはバイナリデータへの署名要求を格納する。

文字列を署名対象とする場合は、`encoding`で指定された方法に従ってバイト列へ変換し、そのバイト列を署名対象とする。

アプリケーションは署名処理を行う前に、署名対象の内容、エンコード方式、署名目的を利用者へ明示することを推奨する。

#### ペイロード

| 項目                      | 必須 | 説明                                                                           |
| ------------------------- | ---: | ------------------------------------------------------------------------------ |
| `message`                 | 必須 | 署名対象のメッセージまたはエンコード済みデータ                                 |
| `encoding`                | 必須 | `message`のエンコード方式                                                      |
| `purpose`                 | 任意 | 署名の用途を示す文字列                                                         |
| `expectedSignerPublicKey` | 任意 | 想定する署名者の公開鍵                                                         |
| `requestId`               | 任意 | 署名要求と署名結果の対応付けなど、アプリケーション側の状態管理に使用する識別子 |

`encoding`には、次の値を使用する。

- `utf-8`
- `base64`
- `hex`

`purpose`はアプリケーションが署名目的を表示するための補助情報であり、署名対象データそのものには含めない。

用途の例：

- `authentication`
- `ownership-proof`
- `agreement`
- `generic`

```json
{
  "message": "Login challenge: abc123",
  "encoding": "utf-8",
  "purpose": "authentication",
  "expectedSignerPublicKey": "B101CC4B46B5C7B1D7DF50D1EB60C19FF4B2E2D91F790DB3660D6321ACF1719B",
  "requestId": "018F4D7C..."
}
```

バイナリデータを扱う場合は、`base64`または`hex`を使用する。

```json
{
  "message": "4C6F67696E206368616C6C656E67653A20616263313233",
  "encoding": "hex",
  "purpose": "authentication",
  "requestId": "018F4D7C..."
}
```

### 署名：`signature`

トランザクション署名、連署、またはメッセージ署名を格納する。

#### ペイロード

| 項目              | 必須 | 説明                                 |
| ----------------- | ---: | ------------------------------------ |
| `signatureType`   | 必須 | 署名種別                             |
| `signature`       | 必須 | 署名値                               |
| `signerPublicKey` | 必須 | 署名者の公開鍵                       |
| `targetHash`      | 必須 | 署名対象を識別するハッシュ           |
| `requestId`       | 任意 | 元の署名要求と対応付けるための識別子 |

`signatureType`には、次の値を使用する。

- `transaction`
- `cosignature`
- `message`

`targetHash`には、署名対象に応じて次の値を格納する。

- `transaction`: 署名対象トランザクションを識別するハッシュ
- `cosignature`: 連署対象となるトランザクションハッシュ
- `message`: 署名対象メッセージのバイト列から算出したハッシュ

```json
{
  "signatureType": "cosignature",
  "targetHash": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "signerPublicKey": "B101CC4B46B5C7B1D7DF50D1EB60C19FF4B2E2D91F790DB3660D6321ACF1719B",
  "signature": "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
  "requestId": "018F4D7C..."
}
```

メッセージ署名の場合は、`signatureType`に`message`を指定する。

```json
{
  "signatureType": "message",
  "targetHash": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "signerPublicKey": "B101CC4B46B5C7B1D7DF50D1EB60C19FF4B2E2D91F790DB3660D6321ACF1719B",
  "signature": "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
  "requestId": "018F4D7C..."
}
```

### ウォレット接続要求：`connection-request`

dAppからウォレットへの接続要求を格納する。

接続対象のチェーンとネットワークは、共通エンベロープの`chain`および`network`を使用する。

#### ペイロード

| 項目          | 必須 | 説明                                                   |
| ------------- | ---: | ------------------------------------------------------ |
| `application` | 必須 | 接続を要求するアプリケーションの自己申告情報           |
| `permissions` | 必須 | 要求する権限の重複のない配列                           |
| `requestId`   | 必須 | 要求と応答を対応付けるための、衝突しない不透明な識別子 |

`application`は次の項目を持つ。

| 項目      | 必須 | 説明                       |
| --------- | ---: | -------------------------- |
| `name`    | 必須 | 表示用のアプリケーション名 |
| `origin`  | 必須 | 表示用の接続元             |
| `iconUrl` | 任意 | 表示用アイコンのURL        |

`permissions`には次の値のみを使用する。

- `account`: 選択されたアカウントのアドレスと公開鍵の取得
- `sign-transaction`: トランザクション署名の要求
- `sign-message`: メッセージ署名の要求

未知の権限を含む要求は承認しない。

`application`の各項目は要求者が自己申告する表示上の補助情報であり、アプリケーションの本人性や信頼性の根拠としてはならない。特に`origin`は実際の搬送元と照合できる場合は別途検証し、`iconUrl`は外部リソースの取得による追跡、悪意のあるコンテンツ、過大なデータなどに配慮して扱う。

```json
{
  "application": {
    "name": "Example dApp",
    "origin": "https://example.com",
    "iconUrl": "https://example.com/icon.png"
  },
  "permissions": ["account", "sign-transaction", "sign-message"],
  "requestId": "018F4D7C..."
}
```

### ウォレット接続応答：`connection-response`

ウォレットが接続要求を承認または拒否した結果を格納する。

共通エンベロープの`chain`および`network`は元の要求と一致させる。

#### ペイロード

| 項目          |   必須 | 説明                                              |
| ------------- | -----: | ------------------------------------------------- |
| `approved`    |   必須 | 接続を承認した場合は`true`、拒否した場合は`false` |
| `account`     | 承認時 | ウォレットが公開を承認したアカウント情報          |
| `permissions` | 承認時 | 実際に付与した権限の重複のない配列                |
| `requestId`   |   必須 | 元の接続要求と同じ識別子                          |

`account`は次の項目を持つ。

| 項目        | 必須 | 説明                                          |
| ----------- | ---: | --------------------------------------------- |
| `address`   | 必須 | 承認されたNEMまたはSymbolアカウントのアドレス |
| `publicKey` | 必須 | 承認されたアカウントの公開鍵                  |

承認応答の`permissions`は元の要求に含まれる権限の部分集合でなければならず、要求されていない権限を付与してはならない。`account.address`、`account.publicKey`および共通エンベロープのネットワークは互いに整合しなければならない。受信側はアドレスを公開鍵から再計算し、これらを検証する。

承認時の例：

```json
{
  "approved": true,
  "account": {
    "address": "TAC5EWBFKGBCE7TFVEE4UTLAYUT4P4PYI7GO4GA",
    "publicKey": "B101CC4B46B5C7B1D7DF50D1EB60C19FF4B2E2D91F790DB3660D6321ACF1719B"
  },
  "permissions": ["account", "sign-transaction", "sign-message"],
  "requestId": "018F4D7C..."
}
```

拒否時は`account`および`permissions`を格納せず、アカウント情報や権限情報を開示しない。

```json
{
  "approved": false,
  "requestId": "018F4D7C..."
}
```

接続承認は当該要求に対する権限付与である。後続する署名要求やアカウント情報の利用時にも、接続状態が有効であり、必要な権限が付与済みであることを都度検証する。

## 暗号化

`account`および`mnemonic`は暗号化を必須とする。

暗号化対象は、各フォーマットの`payload`をCBORエンコードしたバイナリデータとする。

暗号化後は、`payload`に暗号化データと暗号化パラメータを格納する。

```json
{
  "protocol": "SNIF",
  "version": 1,
  "type": "account",
  "chain": "symbol",
  "network": {
    "id": 152,
    "generationHashSeed": "57F7DA20..."
  },
  "options": {
    "encryption": "aes-256-gcm",
    "compression": "none"
  },
  "payload": {
    "kdf": {
      "algorithm": "argon2id",
      "salt": "...",
      "memory": 65536,
      "iterations": 3,
      "parallelism": 4
    },
    "nonce": "...",
    "ciphertext": "...",
    "authenticationTag": "..."
  }
}
```

暗号化アルゴリズムやKDFの詳細は、暗号化仕様として別途定義する。

## 圧縮

圧縮は任意機能とする。

アドレス、公開鍵、秘密鍵、署名などは圧縮効果が小さいため、通常は`none`を使用する。

大きなAggregate Transactionなど、圧縮によってデータサイズが明確に減少する場合のみ圧縮を適用する。

```json
{
  "options": {
    "encryption": "none",
    "compression": "deflate"
  }
}
```

圧縮を使用する場合は、圧縮前より十分にデータサイズが小さくなることを送信側で確認することを推奨する。
