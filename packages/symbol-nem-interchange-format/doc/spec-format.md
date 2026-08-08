# Symbol/NEM Interchange Format（SNIF）v1 フォーマット設計書

## 1. 目的と設計範囲

本書は、SNIF v1でアプリケーション間を受け渡すJSONフォーマットを定義する。対象は共通エンベロープ、標準データタイプ、byte列表現、機密payloadの保護表現、およびフォーマットとしての責任境界である。

SNIFはデータ交換フォーマットであり、次は定義しない。

- QR、Animated QR、Deep Link、Clipboard、NFC、Relay、HTTP、WebSocket等の搬送方法
- UI、利用者承認、認証・認可
- 接続セッションの確立、維持、失効、永続化
- トランザクションの作成、意味検証、署名の生成・検証、連署、アナウンス
- リプレイ防止、重複実行防止等の状態管理
- 秘密鍵、ニーモニック、パスワード等の永続保存

フォーマット設計では、異なる実装間で同じSNIFデータを同じ交換上の意味として解釈できることを優先する。ライブラリAPI上の利便性を理由としてwire formatの標準タイプや意味を増やさない。

## 2. Wire Format

### 2.1 JSON

SNIF v1のwire formatはJSONのみとする。

- SNIF v1準拠実装はJSONを生成・受理する。
- CBORその他のバイナリwire formatはv1では定義しない。
- JSON以外の表現との変換規則はSNIF v1の適合要件に含めない。
- JSONのcanonicalization／正規化規則は定義しない。

SNIFはデータ転送を目的とするため、論理的に同じJSONを同一の文字列または同一のbyte列へ正規化することを要求しない。

### 2.2 byte列

SNIF v1でbyte列をJSON上に格納する場合は、hex文字列のみを使用する。

- 1 byteを2文字の16進数で表現する。
- `0x` 等のプレフィックスは付与しない。
- 英字の大文字・小文字は区別しない。
- Base64等の他のbyte列表現はv1では定義しない。
- `encoding` 等の形式識別フィールドは設けない。

この規則は、トランザクションpayload、秘密鍵、公開鍵、`generationHashSeed`、暗号化で使用するbyte列等に適用する。

## 3. 共通エンベロープ

SNIFデータは次の共通フィールドを使用する。

```json
{
  "version": 1,
  "type": "...",
  "chain": "...",
  "network": "...",
  "generationHashSeed": "...",
  "id": "...",
  "replyTo": "...",
  "payload": {}
}
```

### 3.1 共通フィールド

- `version`: 必須のJSON integer。SNIFのバージョン。v1では `1`。
- `type`: 必須のJSON string。データタイプを表す。標準type以外の文字列も使用できる。
- `chain`: 必須のJSON string。チェーン識別子を表す。`symbol` / `nem` に限らず任意の文字列を格納できる。
- `network`: 必須のJSON string。対象ネットワークを表す非空文字列。
- `generationHashSeed`: 任意のJSON string。Symbolネットワークを識別する補助情報。hex文字列。NEMでは使用しない。
- `id`: 任意のJSON string。そのSNIFデータ自身を識別する非空文字列。
- `replyTo`: 任意のJSON string。応答対象となるSNIFデータの `id` を参照する非空文字列。
- `payload`: 標準typeの平文時は必須のJSON object。データタイプ固有の内容。`account` / `mnemonic` の保護時は使用しない。
- `protectedPayload`: `account` または `mnemonic` の保護時だけ使用するJSON object。`payload` と同時に使用しない。

`generationHashSeed`、`id`、`replyTo` は必要な場合のみ含める。

### 3.2 `payload` と `protectedPayload`

通常のデータは `payload` に格納する。

`account` と `mnemonic` を暗号化する場合のみ、`payload` の代わりに `protectedPayload` を使用する。`payload` と `protectedPayload` は同時に使用しない。

### 3.3 `id` / `replyTo`

`id` / `replyTo` の形式はUUID等に限定しない。識別子の生成方式もSNIFでは定義しない。

SNIFは `replyTo` が実在する要求を参照しているか、処理済みか、期限切れか、重複実行かを検証しない。要求と応答を関連付ける情報を搬送できることまでを責務とする。

## 4. チェーンとネットワーク

### 4.1 `chain`

`chain` は文字列とする。SNIF v1の標準値は次のとおり。

- `symbol`
- `nem`

上記以外の任意の文字列も格納できる。Symbol/NEM以外のチェーンやチェーン非依存データを表す値は利用アプリケーション側が定義する。SNIFはそれらの値の意味を標準化せず、チェーン固有の意味を検証しない。

### 4.2 `network`

`network` は非空文字列とする。SNIF v1の標準値は次のとおり。

- `mainnet`
- `testnet`

上記以外の任意の非空文字列も格納できる。

SNIFは `network` の意味上の妥当性や、`chain` との組み合わせが実在・有効であるかを検証しない。

### 4.3 `generationHashSeed`

`generationHashSeed` はSymbolネットワークを識別するための任意の補助情報であり、hex文字列として共通エンベロープに格納する。

NEMには相当する値がないため使用しない。

SNIFは `generationHashSeed` の内容が正しいか、`chain` / `network` と一致するかを検証しない。必要な照合は使用アプリケーション側が既知のネットワーク情報を用いて行う。

## 5. 標準データタイプ

SNIF v1で定義する標準タイプは次の7種とする。

- `address`
- `contact`
- `account`
- `mnemonic`
- `transaction`
- `connection-request`
- `connection-response`

### 5.0 標準payloadの共通規則

- 標準typeの平文 `payload` はJSON objectとする。`payload` が文字列、配列、数値、真偽値または `null` の場合は形式不正とする。`account` / `mnemonic` の保護時は `protectedPayload` を使用し、平文 `payload` を持たない。
- 以下で「文字列」と記載した値はJSON string、「整数」と記載した値はJSON numberのうち小数部を持たない値、「boolean」と記載した値はJSON booleanとする。
- 「hex文字列」と記載した値は、2文字で1 byteを表す偶数長のJSON stringとする。使用できる文字は `0-9`、`a-f`、`A-F` とし、`0x` prefixは使用しない。
- 明示された必須項目は存在しなければならない。任意項目は存在しない場合を許容する。
- 標準typeのpayloadに含まれる未定義プロパティの受理可否は、SNIFがその意味を定義していない範囲について利用側が判断する。未定義プロパティを別の標準項目として推測してはならない。

### 5.1 `address`

単一のアドレスを受け渡す最小タイプ。

```json
{
  "version": 1,
  "type": "address",
  "chain": "symbol",
  "network": "mainnet",
  "payload": {
    "address": "..."
  }
}
```

- `payload.address`: アドレス。

`payload.address` は必須の文字列とする。

`chain` / `network` は共通エンベロープで保持し、payload内では重複させない。

SNIFはアドレスのチェックサム、対象チェーン・ネットワークとの対応、実在性、利用可能性を検証しない。

### 5.2 `contact`

人、組織、サービス等の連絡先情報を受け渡すタイプ。`address` が単一の宛先識別子を表すのに対し、`contact` は表示・識別用の公開メタデータをまとめて搬送する。

```json
{
  "version": 1,
  "type": "contact",
  "chain": "symbol",
  "network": "mainnet",
  "payload": {
    "name": "Alice",
    "address": "...",
    "publicKey": "...",
    "note": "...",
    "icon": "https://example.com/icon.png"
  }
}
```

- `name`: 必須の文字列。表示名。
- `address`: 任意の文字列。アドレス。
- `publicKey`: 任意のhex文字列。公開鍵。
- `note`: 任意の文字列。自由記述。
- `icon`: 任意の文字列。アイコンへのURI参照。

v1ではアイコン画像を直接埋め込まずURI参照とする。URI先の取得、可用性、真正性、画像形式等はSNIFの責務外とする。

SNIFは表示名、アドレス、公開鍵、アイコン等の真正性や相互関係を検証しない。

### 5.3 `account`

秘密鍵、公開鍵、アドレスをまとめて受け渡すタイプ。

平文例:

```json
{
  "version": 1,
  "type": "account",
  "chain": "symbol",
  "network": "mainnet",
  "payload": {
    "privateKey": "...",
    "publicKey": "...",
    "address": "..."
  }
}
```

`payload` は次の3項目で構成する。

- `privateKey`: 必須のhex文字列。秘密鍵。
- `publicKey`: 必須のhex文字列。公開鍵。
- `address`: 必須の文字列。アドレス。

SNIFは秘密鍵から公開鍵・アドレスを導出せず、相互関係を検証しない。

`account` は機密データとして扱う。暗号化する場合は `payload` 全体を第6章の `protectedPayload` で保護する。

### 5.4 `mnemonic`

ニーモニックを受け渡すタイプ。

平文例:

```json
{
  "version": 1,
  "type": "mnemonic",
  "chain": "symbol",
  "network": "mainnet",
  "payload": {
    "mnemonic": "..."
  }
}
```

- `payload.mnemonic`: 必須の文字列。ニーモニック。

派生パス、言語、追加パスフレーズ、ウォレット復元設定等は含めない。

`mnemonic` は機密データとして扱う。暗号化する場合は `payload` 全体を第6章の `protectedPayload` で保護する。

### 5.5 `transaction`

Symbol/NEMのトランザクションpayloadと、受信側へ伝える処理意図、署名要求・応答を搬送するタイプ。

```json
{
  "version": 1,
  "type": "transaction",
  "chain": "symbol",
  "network": "mainnet",
  "generationHashSeed": "...",
  "id": "...",
  "payload": {
    "action": "sign",
    "payload": "..."
  }
}
```

- `payload.payload`: 必須のhex文字列。トランザクション本体を表すbyte列。
- `payload.action`: 任意の文字列。受信側へ伝える処理意図または標準action。

標準 `action` は次のとおり。

- `display`: 表示
- `sign`: 署名要求
- `sign-response`: 署名応答
- `cosign`: 連署要求
- `announce`: アナウンス
- `sign-and-announce`: 署名要求＋アナウンス
- `cosign-and-announce`: 連署要求＋アナウンス

#### 5.5.1 署名要求

`action` が `sign` の場合、`payload` は署名要求とする。署名要求では共通エンベロープの `id` を必須とする。

- `id` は必須の非空文字列であり、署名応答が参照する要求識別子とする。
- `payload.payload` は必須のhex文字列であり、署名対象となるtransaction本体のbyte列を表す。
- 署名対象はJSON envelope、JSON文字列、JSON canonicalization結果または `action` を含むSNIF payloadではない。
- 適合実装は、`payload.payload` をhex decodeしたbyte列を、SNIFの署名要求・応答で共通に扱う署名対象byte列とする。実装はこのbyte列へフィールドの追加、削除、並べ替え、文字列表現の変換を行ってはならない。
- `generationHashSeed` は共通エンベロープ上の任意のhex文字列であり、署名対象byte列へ暗黙に追加されない。Symbolプロトコルの署名処理でgeneration hashを付加する場合、その処理は対象チェーンの署名実装が担い、SNIFの形式検証は実行しない。

#### 5.5.2 署名応答

`action` が `sign-response` の場合、署名要求への応答とする。署名応答では `replyTo` を必須とし、元の署名要求の `id` を参照する。

```json
{
  "version": 1,
  "type": "transaction",
  "chain": "symbol",
  "network": "mainnet",
  "id": "sign-response-001",
  "replyTo": "sign-request-001",
  "payload": {
    "action": "sign-response",
    "payload": "00112233",
    "result": "approved",
    "signature": "aabbccdd"
  }
}
```

- `payload.payload`: 必須のhex文字列。署名要求で扱ったtransaction本体のbyte列を表す。
- `payload.result`: 必須の文字列。`approved` または `rejected`。
- `payload.signature`: `result` が `approved` の場合に必須のhex文字列。署名関連情報として搬送する署名byte列を表す。
- `result` が `rejected` の場合、`payload.signature` は存在してはならない。拒否は署名応答を返さないことや形式不正で代用してはならない。

`sign-response` の `replyTo` は対応する `sign` 要求の `id` と同じ値でなければならない。`payload.payload` も対応する要求の `payload.payload` と同じ論理値でなければならない。SNIFは `replyTo` が実在する要求を参照するか、transaction本体と署名の対応、署名の有効性、署名者の真正性または利用者の承認を検証しない。

`action` を省略した場合は、処理要求を伴わない単純なトランザクション受け渡しとする。

`action` は命令ではなく処理意図である。実際に表示、署名、連署、アナウンスするかは受信側が判断する。

SNIFはトランザクションの未署名・署名済み・部分署名済み等の状態を別フィールドでは表現しない。署名・連署後のトランザクションも同じ `transaction` タイプで受け渡しでき、状態は利用側がトランザクション本体から判断する。

SNIFは指定された `action` がそのトランザクションに対して実行可能かを検証しない。

### 5.6 `connection-request`

dApp・サービス等からウォレット／署名アプリへ接続要求を搬送するタイプ。

```json
{
  "version": 1,
  "type": "connection-request",
  "chain": "symbol",
  "network": "mainnet",
  "id": "...",
  "payload": {
    "name": "Example dApp",
    "url": "https://example.com",
    "permissions": [
      "address",
      "public-key"
    ],
    "icon": "https://example.com/icon.png",
    "note": "..."
  }
}
```

- `name`: 任意の文字列。接続要求元の表示名。
- `url`: 必須の文字列。接続要求元が自己申告するURL。
- `permissions`: 必須の文字列配列。要求する情報。
- `icon`: 任意の文字列。アイコンURI。
- `note`: 任意の文字列。接続目的等の補足。

標準 `permission` は次の2種とする。

- `address`（文字列）
- `public-key`（文字列）

`name`、`url`、`icon` 等は自己申告情報である。SNIFは要求元の真正性、URLの所有者、実際の送信元ドメインとの一致等を保証しない。

接続セッションの確立、維持、失効、永続化はSNIFの責務外とする。

### 5.7 `connection-response`

`connection-request` に対する許可または拒否を搬送するタイプ。

許可時:

```json
{
  "version": 1,
  "type": "connection-response",
  "chain": "symbol",
  "network": "mainnet",
  "id": "...",
  "replyTo": "...connection-request-id...",
  "payload": {
    "status": "approved",
    "address": "...",
    "publicKey": "..."
  }
}
```

拒否時:

```json
{
  "version": 1,
  "type": "connection-response",
  "chain": "symbol",
  "network": "mainnet",
  "replyTo": "...connection-request-id...",
  "payload": {
    "status": "rejected"
  }
}
```

`payload.status` は必須の文字列で、次の2値のいずれかとする。

- `approved`
- `rejected`

`approved` の場合、`address` は任意の文字列、`publicKey` は任意のhex文字列として、許可した情報を必要な分だけ返却できる。要求された項目の一部だけを返す部分許可も表現できる。

`rejected` の場合、`address` / `publicKey` は返却しない。

`replyTo` が存在する場合は元の `connection-request` の `id` と関連付ける。SNIFは要求されたpermissionと返却内容が一致するか、応答が正当な要求に対応するかを状態として検証しない。

### 5.8 アプリケーション固有タイプ

SNIF v1の標準タイプ以外の `type` をどのように扱うかは使用アプリケーション側で判断する。

アプリケーション固有の `type` と `payload` を利用する場合、そのpayloadの意味、フィールド構造、相互運用性はSNIFでは定義しない。SNIFの標準タイプとして扱ったり、未知の `type` に対して暗黙の処理を実行したりしてはならない。

アプリケーション固有typeの `payload` はJSON objectでなければならない。SNIFはobject内部のプロパティ、値の意味および業務上の妥当性を検証しない。

## 6. 機密payloadの保護表現

`account` および `mnemonic` は、平文時には `payload`、暗号化時には `protectedPayload` を使用する。

`protectedPayload` は機密フィールドだけを選択して暗号化するのではなく、元の `payload` JSON全体を暗号化した表現とする。これにより、平文時と暗号化時でデータタイプ固有の論理構造を変えない。

```json
{
  "version": 1,
  "type": "account",
  "chain": "symbol",
  "network": "mainnet",
  "protectedPayload": {
    "cipher": "...",
    "kdf": {
      "name": "...",
      "salt": "...",
      "params": {}
    },
    "nonce": "...",
    "ciphertext": "...",
    "tag": "..."
  }
}
```

### 6.1 フィールド

- `cipher`: 文字列。使用した暗号方式。必須性は選択した暗号プロファイルで定義する。
- `kdf`: JSON object。鍵導出方式とそのパラメータを格納する。必須性は選択した暗号プロファイルで定義する。
- `kdf.name`: 文字列。使用した鍵導出方式。必須性は選択した暗号プロファイルで定義する。
- `kdf.salt`: hex文字列。鍵導出に使用したsalt。必須性は選択した暗号プロファイルで定義する。
- `kdf.params`: JSON object。鍵導出方式固有のパラメータを格納する。必須性は選択した暗号プロファイルで定義する。
- `nonce`: hex文字列。暗号方式で使用するnonceまたはIV。必須性は選択した暗号プロファイルで定義する。
- `ciphertext`: hex文字列。元の `payload` JSON全体を暗号化したデータ。必須性は選択した暗号プロファイルで定義する。
- `tag`: hex文字列。認証付き暗号で使用する認証タグ。必須性は選択した暗号プロファイルで定義する。

SNIF v1では、パスワードKDFと認証付き暗号（AEAD）を表現できる共通構造としてこれらの項目を定義する。各項目の必須・任意および `kdf.params` の内容は、選択した `cipher` / `kdf` プロファイルが定義する。v1で規範化する必須性と値は6.2で定義する。

暗号アルゴリズム固有の妥当性確認、パスワード・鍵の供給、保存、取得、管理はSNIFの責務外とする。

### 6.2 v1標準暗号プロファイル

SNIF v1の標準暗号プロファイルは `AES-256-GCM + Argon2id` とする。

標準識別値:

- `cipher`: `aes-256-gcm`
- `kdf.name`: `argon2id`

標準プロファイルでは `cipher`、`kdf.name`、`kdf.salt`、`kdf.params`、`nonce`、`ciphertext`、`tag` を必須とする。`kdf.params` には `version`、`memoryCost`、`timeCost`、`parallelism` を含める。

標準プロファイルのAES-256-GCMはAAD（追加認証データ）を使用しない。暗号処理へ渡すAADは空byte列とし、共通エンベロープ、`protectedPayload` のJSON文字列表現、プロパティ順、空白、`cipher` / `kdf` のメタデータその他の外側データをAADとして渡してはならない。`aad` というwire fieldも定義しない。

標準プロファイルの暗号化入力は、保護対象の元の `payload` をJSONとして表現したUTF-8 byte列とする。JSON canonicalizationは行わず、暗号化実装が使用したJSON文字列表現のbyte列を入力とする。復号実装は認証に成功したplaintextをUTF-8としてJSON解析し、6.3の復号後payload検証を行う。

AADを使用しないこと、および外側の共通エンベロープを認証対象に含めないことは、認証成功が外側の共通エンベロープ、送信者、dApp、URL等の真正性を保証しない責任境界と整合する。

標準プロファイルの各フィールドは次のJSON型と構造を持つ。

| フィールド | JSON型 | 必須性・構造 |
| --- | --- | --- |
| `protectedPayload` | object | 必須。`account` または `mnemonic` のエンベロープにのみ存在する。 |
| `cipher` | string | 必須。標準値は `aes-256-gcm`。 |
| `kdf` | object | 必須。`name`、`salt`、`params` を持つ。 |
| `kdf.name` | string | 必須。標準値は `argon2id`。 |
| `kdf.salt` | string | 必須。hex文字列。 |
| `kdf.params` | object | 必須。`version`、`memoryCost`、`timeCost`、`parallelism` を持つ。 |
| `kdf.params.version` | integer | 必須。標準値は `19`。 |
| `kdf.params.memoryCost` | integer | 必須。単位はKiB。標準値は `65536`。 |
| `kdf.params.timeCost` | integer | 必須。標準値は `3`。 |
| `kdf.params.parallelism` | integer | 必須。標準値は `1`。 |
| `nonce` | string | 必須。hex文字列。標準値は12 bytes。 |
| `ciphertext` | string | 必須。hex文字列。 |
| `tag` | string | 必須。hex文字列。標準値は16 bytes。 |

標準プロファイルでは `kdf.params` の4項目を重複、欠落または別のJSON型で表現してはならない。`kdf.params` の整数値の意味的な許容範囲および実行資源の上限は、暗号処理を実行する側のポリシーに委ねるが、標準値から外れたデータを標準生成値として扱ってはならない。

Argon2idの生成時パラメータは次のとおりとする。

- `version`: `19`
- `memoryCost`: `65536` KiB
- `timeCost`: `3`
- `parallelism`: `1`
- salt長: `16` bytes
- 導出鍵長: `32` bytes
- password文字列はUnicode正規化を行わずUTF-8 byte列へ変換してArgon2idへ入力する。

`kdf.params` には、復号時に同じ鍵を再導出するために必要で、他のフィールドから導出できない次の値を格納する。

```json
{
  "version": 19,
  "memoryCost": 65536,
  "timeCost": 3,
  "parallelism": 1
}
```

`saltLength` は実際の `kdf.salt` から判別可能であり、`hashLength` は `AES-256-GCM` 用の256-bit鍵として32 bytesに固定されるため、`kdf.params` には格納しない。

標準プロファイルによる `protectedPayload` の例:

```json
{
  "cipher": "aes-256-gcm",
  "kdf": {
    "name": "argon2id",
    "salt": "...",
    "params": {
      "version": 19,
      "memoryCost": 65536,
      "timeCost": 3,
      "parallelism": 1
    }
  },
  "nonce": "...",
  "ciphertext": "...",
  "tag": "..."
}
```

生成時は上記パラメータを標準値として使用する。復号時は `protectedPayload` に記録された実際のKDFパラメータを使用する。これにより、将来生成時の標準値を変更しても、既存データを同じパラメータで復号できる。

新規生成する `kdf.salt` およびAES-GCMの `nonce` は、暗号学的に安全な乱数源から生成する。

暗号処理を実行する側は、受領したKDFパラメータを実行前に検証し、自身が許容する処理範囲を超える場合は拒否する。

AES-GCMのv1標準値は次のとおり固定する。

- `nonce`: `12` bytes（96 bit）
- `tag`: `16` bytes（128 bit）

標準プロファイルで新規生成する `nonce` は暗号学的に安全な乱数源から生成する。標準プロファイルを復号する実装は、`nonce` が12 bytes、`tag` が16 bytesであることを暗号処理開始前に検証する。

### 6.3 復号後payloadの検証

`account` または `mnemonic` の `protectedPayload` を復号する場合、実装は認証成功後に次の順序で復号結果を検証する。

1. plaintextをUTF-8 byte列としてJSON解析する。
2. JSON値がobjectであることを確認する。
3. 外側の `type` に対応する平文payloadとして、5.3または5.4で定義した必須項目、JSON型およびhex表現を検証する。
4. 検証に成功した場合だけ、復元されたobjectを対応するtypeのpayloadとして受理する。

UTF-8 decode、JSON構文解析または対応するpayload検証に失敗した場合、protectedPayloadは形式上受理してはならない。これら3種類の失敗は、暗号認証の成功とは別の復号後形式検証の失敗である。API仕様では3種類すべてを `DECRYPTED_PAYLOAD_INVALID` として公開し、復号済みbyte列、JSON内容および問題箇所の `path` を公開しない。SNIFは復号後payloadのチェーン上・業務上の意味や秘密情報の妥当性を検証しない。

## 7. フォーマットの責任境界

SNIFが扱うのは、交換データを構造として識別・解析するために必要な形式上の情報までとする。SNIFとして解析できることは、その内容が業務上・チェーン上・セキュリティ上妥当であることを意味しない。

### 7.1 形式として検証する事項

SNIF v1の形式検証は、少なくとも次を判定する。

- JSONとして解釈でき、共通エンベロープの必須項目が定義されたJSON型で存在すること。
- `version` が `1` であること。
- 標準typeの平文 `payload` がobjectであり、各typeで定義した必須項目、JSON型およびhex表現を満たすこと。`account` / `mnemonic` の保護時は `protectedPayload` の検証を行う。
- 標準type以外のアプリケーション固有typeの `payload` がJSON objectであること。object内部の意味は検証しない。
- `account` / `mnemonic` では `payload` と `protectedPayload` の一方だけが存在すること。その他のtypeでは `protectedPayload` を使用しないこと。
- 標準暗号プロファイルでは、`protectedPayload` の必須項目、`kdf.params` の4つのinteger項目、hex表現およびnonce/tagのbyte長を満たすこと。
- `transaction` の `action` が `sign` の場合、`id` が存在し、署名要求として `payload.payload` がhex文字列であること。
- `transaction` の `action` が `sign-response` の場合、`replyTo`、`payload.payload`、`payload.result` が存在し、`payload.result` が `approved` または `rejected` であること。`approved` では `signature` を必須とし、`rejected` では `signature` を禁止すること。
- `connection-response` では `payload.status` が存在し、`payload.status` が `approved` または `rejected` であること。`rejected` では `address` と `publicKey` を禁止すること。
- `protectedPayload` の復号に成功した場合、復号結果を対応する標準typeの平文payloadとしてJSON型、必須項目およびhex表現について検証すること。検証に失敗した復号結果は形式上受理しないこと。

形式検証は、`sign-response` の `replyTo` が実在する要求を参照するか、応答の `payload.payload` が要求と同じ論理値かどうかは判定しない。これらは状態および意味の検証である。

SNIFは次を保証しない。

- `chain` / `network` / `generationHashSeed` の意味上の正しさ、および相互の一致
- アドレス、公開鍵、秘密鍵等の相互関係
- トランザクションのチェーン上の有効性
- 署名、連署、アナウンスの実行可否
- dApp、URL、表示名、アイコン等の真正性
- 接続セッションの状態
- `id` / `replyTo` が示す要求・応答の実在性や処理状態
- リプレイ防止、重複実行防止
- 搬送路の安全性
- 永続的な秘密情報の保存

また、次の取り扱い方針はSNIFでは規定せず、使用アプリケーション側で判断する。

- 数値の許容範囲
- `null` の扱い
- 未知プロパティの扱い
- 未知の `type` / `action` / `permission` の扱い
- JSON重複キーの扱い

これらの判断をSNIFの形式検証成功と混同してはならない。

## 8. v1の拡張方針

SNIF v1では、必要性が生じていない将来拡張のためだけのフィールドは予約しない。

- byte列表現はhexのみとし、形式識別フィールドは設けない。
- JSON canonicalizationは定義しない。
- 新しいbyte列表現、標準タイプ、暗号方式固有の追加情報等が必要になった場合は、その時点で互換性を考慮して仕様を拡張する。

ライブラリAPI、実装クラス、UUID生成方式、QR等の搬送方式、Symbol/NEM固有のnetwork対応表は本フォーマット設計の対象外とする。

## 9. 適合テストfixture

SNIF v1の実装間相互運用性を確認するため、本章のfixtureを仕様上の固定テストデータとして定義する。fixtureはフォーマットの構造・表現規則と標準暗号プロファイルの一致を確認するためのものであり、アドレス、鍵、トランザクション等のチェーン上の意味妥当性を確認するものではない。

### 9.1 fixtureの判定規則

- `expected.result` が `accept` のfixtureは、SNIF v1の形式として受理し、JSONのプロパティ順や空白に依存せず同じ論理値として解析できなければならない。
- `expected.result` が `reject` のfixtureは、SNIF v1の形式として拒否しなければならない。
- `expected.reason` はfixture上の拒否理由分類であり、ライブラリAPIの公開error codeを規定するものではない。
- hex英字は大文字・小文字の双方を受理する。fixture内に大文字hexを含む正常例を置く。
- 未知の `action` / `permission` は文字列として搬送可能であるため、存在だけを理由に拒否してはならない。
- アプリケーション固有typeの `payload` はJSON objectでなければならないが、その内部の意味は検証しない。
- 本章の秘密鍵、ニーモニック、password、salt、nonce、導出鍵等はテスト専用の公開値であり、実資産・実アカウントに使用してはならない。

### 9.2 最低fixture matrix

| 対象 | 最低限確認する内容 |
| --- | --- |
| 標準type | v1標準7typeを各1件以上。`connection-response` はapproved/rejectedの双方を含む。 |
| チェーン | Symbol/NEMのaddressとtransactionを各1件以上。 |
| 拡張 | custom type、未知action、未知permissionの受理。 |
| 拒否系 | 未対応version、必須項目欠落、不正JSON型、不正hex、payload競合、protectedPayload使用違反、不正status等。 |
| 暗号化 | account/mnemonicについて固定password、salt、nonce、導出鍵、plaintext、ciphertext、tag、復号期待payloadを含む。AADなし、認証失敗、復号後payload不正も確認する。 |

### 9.3 正常系fixture

```json
[
  {
    "id": "valid-address-symbol",
    "input": {
      "version": 1,
      "type": "address",
      "chain": "symbol",
      "network": "mainnet",
      "payload": {
        "address": "SYMBOL-ADDRESS-FIXTURE"
      }
    },
    "expected": {
      "result": "accept",
      "standardType": "address"
    }
  },
  {
    "id": "valid-address-nem",
    "input": {
      "version": 1,
      "type": "address",
      "chain": "nem",
      "network": "mainnet",
      "payload": {
        "address": "NEM-ADDRESS-FIXTURE"
      }
    },
    "expected": {
      "result": "accept",
      "standardType": "address"
    }
  },
  {
    "id": "valid-contact",
    "input": {
      "version": 1,
      "type": "contact",
      "chain": "symbol",
      "network": "testnet",
      "payload": {
        "name": "Alice",
        "address": "CONTACT-ADDRESS-FIXTURE",
        "publicKey": "00112233",
        "note": "fixture",
        "icon": "https://example.com/icon.png"
      }
    },
    "expected": {
      "result": "accept",
      "standardType": "contact"
    }
  },
  {
    "id": "valid-account-plain",
    "input": {
      "version": 1,
      "type": "account",
      "chain": "symbol",
      "network": "testnet",
      "payload": {
        "privateKey": "00112233",
        "publicKey": "44556677",
        "address": "ACCOUNT-ADDRESS-FIXTURE"
      }
    },
    "expected": {
      "result": "accept",
      "standardType": "account",
      "protectionState": "plain"
    }
  },
  {
    "id": "valid-mnemonic-plain",
    "input": {
      "version": 1,
      "type": "mnemonic",
      "chain": "symbol",
      "network": "mainnet",
      "payload": {
        "mnemonic": "fixture mnemonic text"
      }
    },
    "expected": {
      "result": "accept",
      "standardType": "mnemonic",
      "protectionState": "plain"
    }
  },
  {
    "id": "valid-transaction-symbol",
    "input": {
      "version": 1,
      "type": "transaction",
      "chain": "symbol",
      "network": "mainnet",
      "generationHashSeed": "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
      "id": "tx-symbol-001",
      "payload": {
        "action": "sign",
        "payload": "00112233"
      }
    },
    "expected": {
      "result": "accept",
      "standardType": "transaction"
    }
  },
  {
    "id": "valid-transaction-nem",
    "input": {
      "version": 1,
      "type": "transaction",
      "chain": "nem",
      "network": "testnet",
      "id": "tx-nem-001",
      "payload": {
        "action": "display",
        "payload": "A1B2C3D4"
      }
    },
    "expected": {
      "result": "accept",
      "standardType": "transaction"
    }
  },
  {
    "id": "valid-transaction-sign-response-approved",
    "input": {
      "version": 1,
      "type": "transaction",
      "chain": "symbol",
      "network": "mainnet",
      "id": "tx-sign-response-approved-001",
      "replyTo": "tx-symbol-001",
      "payload": {
        "action": "sign-response",
        "payload": "00112233",
        "result": "approved",
        "signature": "aabbccdd"
      }
    },
    "expected": {
      "result": "accept",
      "standardType": "transaction",
      "signatureResult": "approved"
    }
  },
  {
    "id": "valid-transaction-sign-response-rejected",
    "input": {
      "version": 1,
      "type": "transaction",
      "chain": "symbol",
      "network": "mainnet",
      "replyTo": "tx-symbol-001",
      "payload": {
        "action": "sign-response",
        "payload": "00112233",
        "result": "rejected"
      }
    },
    "expected": {
      "result": "accept",
      "standardType": "transaction",
      "signatureResult": "rejected"
    }
  },
  {
    "id": "valid-connection-request",
    "input": {
      "version": 1,
      "type": "connection-request",
      "chain": "symbol",
      "network": "mainnet",
      "id": "connection-request-001",
      "payload": {
        "name": "Example dApp",
        "url": "https://example.com",
        "permissions": [
          "address",
          "public-key"
        ],
        "icon": "https://example.com/icon.png",
        "note": "fixture"
      }
    },
    "expected": {
      "result": "accept",
      "standardType": "connection-request"
    }
  },
  {
    "id": "valid-connection-response-approved",
    "input": {
      "version": 1,
      "type": "connection-response",
      "chain": "symbol",
      "network": "mainnet",
      "id": "connection-response-001",
      "replyTo": "connection-request-001",
      "payload": {
        "status": "approved",
        "address": "APPROVED-ADDRESS-FIXTURE",
        "publicKey": "00112233"
      }
    },
    "expected": {
      "result": "accept",
      "standardType": "connection-response"
    }
  },
  {
    "id": "valid-connection-response-rejected",
    "input": {
      "version": 1,
      "type": "connection-response",
      "chain": "symbol",
      "network": "mainnet",
      "replyTo": "connection-request-001",
      "payload": {
        "status": "rejected"
      }
    },
    "expected": {
      "result": "accept",
      "standardType": "connection-response"
    }
  },
  {
    "id": "valid-custom-type",
    "input": {
      "version": 1,
      "type": "com.example.metadata",
      "chain": "custom-chain",
      "network": "custom-network",
      "payload": {
        "name": "fixture",
        "count": 1,
        "enabled": true,
        "nested": {
          "value": null
        }
      }
    },
    "expected": {
      "result": "accept",
      "standardType": null
    }
  },
  {
    "id": "valid-unknown-action",
    "input": {
      "version": 1,
      "type": "transaction",
      "chain": "symbol",
      "network": "mainnet",
      "payload": {
        "action": "vendor-preview",
        "payload": "00"
      }
    },
    "expected": {
      "result": "accept",
      "standardType": "transaction",
      "note": "unknown action is transported as a string"
    }
  },
  {
    "id": "valid-unknown-permission",
    "input": {
      "version": 1,
      "type": "connection-request",
      "chain": "symbol",
      "network": "mainnet",
      "payload": {
        "url": "https://example.com",
        "permissions": [
          "vendor-capability"
        ]
      }
    },
    "expected": {
      "result": "accept",
      "standardType": "connection-request",
      "note": "unknown permission is transported as a string"
    }
  }
]
```

### 9.4 拒否系fixture

```json
[
  {
    "id": "reject-missing-version",
    "input": {
      "type": "address",
      "chain": "symbol",
      "network": "mainnet",
      "payload": {
        "address": "X"
      }
    },
    "expected": {
      "result": "reject",
      "reason": "missing-required-field",
      "path": "/version"
    }
  },
  {
    "id": "reject-unsupported-version",
    "input": {
      "version": 2,
      "type": "address",
      "chain": "symbol",
      "network": "mainnet",
      "payload": {
        "address": "X"
      }
    },
    "expected": {
      "result": "reject",
      "reason": "unsupported-version"
    }
  },
  {
    "id": "reject-missing-network",
    "input": {
      "version": 1,
      "type": "address",
      "chain": "symbol",
      "payload": {
        "address": "X"
      }
    },
    "expected": {
      "result": "reject",
      "reason": "missing-required-field",
      "path": "/network"
    }
  },
  {
    "id": "reject-type-not-string",
    "input": {
      "version": 1,
      "type": 1,
      "chain": "symbol",
      "network": "mainnet",
      "payload": {
        "address": "X"
      }
    },
    "expected": {
      "result": "reject",
      "reason": "invalid-json-type",
      "path": "/type"
    }
  },
  {
    "id": "reject-address-payload-not-object",
    "input": {
      "version": 1,
      "type": "address",
      "chain": "symbol",
      "network": "mainnet",
      "payload": "not-an-object"
    },
    "expected": {
      "result": "reject",
      "reason": "invalid-json-type",
      "path": "/payload"
    }
  },
  {
    "id": "reject-contact-name-not-string",
    "input": {
      "version": 1,
      "type": "contact",
      "chain": "symbol",
      "network": "mainnet",
      "payload": {
        "name": 1
      }
    },
    "expected": {
      "result": "reject",
      "reason": "invalid-json-type",
      "path": "/payload/name"
    }
  },
  {
    "id": "reject-connection-permission-not-string",
    "input": {
      "version": 1,
      "type": "connection-request",
      "chain": "symbol",
      "network": "mainnet",
      "payload": {
        "url": "https://example.com",
        "permissions": [
          1
        ]
      }
    },
    "expected": {
      "result": "reject",
      "reason": "invalid-json-type",
      "path": "/payload/permissions/0"
    }
  },
  {
    "id": "reject-odd-length-hex",
    "input": {
      "version": 1,
      "type": "transaction",
      "chain": "symbol",
      "network": "mainnet",
      "payload": {
        "payload": "ABC"
      }
    },
    "expected": {
      "result": "reject",
      "reason": "invalid-hex",
      "path": "/payload/payload"
    }
  },
  {
    "id": "reject-sign-request-missing-id",
    "input": {
      "version": 1,
      "type": "transaction",
      "chain": "symbol",
      "network": "mainnet",
      "payload": {
        "action": "sign",
        "payload": "00112233"
      }
    },
    "expected": {
      "result": "reject",
      "reason": "missing-required-field",
      "path": "/id"
    }
  },
  {
    "id": "reject-0x-hex",
    "input": {
      "version": 1,
      "type": "transaction",
      "chain": "symbol",
      "network": "mainnet",
      "payload": {
        "payload": "0x0011"
      }
    },
    "expected": {
      "result": "reject",
      "reason": "invalid-hex",
      "path": "/payload/payload"
    }
  },
  {
    "id": "reject-non-hex",
    "input": {
      "version": 1,
      "type": "contact",
      "chain": "symbol",
      "network": "mainnet",
      "payload": {
        "name": "Alice",
        "publicKey": "GG"
      }
    },
    "expected": {
      "result": "reject",
      "reason": "invalid-hex",
      "path": "/payload/publicKey"
    }
  },
  {
    "id": "reject-account-payload-conflict",
    "input": {
      "version": 1,
      "type": "account",
      "chain": "symbol",
      "network": "mainnet",
      "payload": {
        "privateKey": "00",
        "publicKey": "11",
        "address": "X"
      },
      "protectedPayload": {
        "cipher": "custom-aead",
        "ciphertext": "22"
      }
    },
    "expected": {
      "result": "reject",
      "reason": "payload-conflict"
    }
  },
  {
    "id": "reject-protected-payload-on-transaction",
    "input": {
      "version": 1,
      "type": "transaction",
      "chain": "symbol",
      "network": "mainnet",
      "protectedPayload": {
        "cipher": "custom-aead",
        "ciphertext": "00"
      }
    },
    "expected": {
      "result": "reject",
      "reason": "protected-payload-not-allowed",
      "path": "/protectedPayload"
    }
  },
  {
    "id": "reject-connection-request-missing-url",
    "input": {
      "version": 1,
      "type": "connection-request",
      "chain": "symbol",
      "network": "mainnet",
      "payload": {
        "permissions": [
          "address"
        ]
      }
    },
    "expected": {
      "result": "reject",
      "reason": "missing-required-field",
      "path": "/payload/url"
    }
  },
  {
    "id": "reject-connection-request-missing-permissions",
    "input": {
      "version": 1,
      "type": "connection-request",
      "chain": "symbol",
      "network": "mainnet",
      "payload": {
        "url": "https://example.com"
      }
    },
    "expected": {
      "result": "reject",
      "reason": "missing-required-field",
      "path": "/payload/permissions"
    }
  },
  {
    "id": "reject-connection-response-status",
    "input": {
      "version": 1,
      "type": "connection-response",
      "chain": "symbol",
      "network": "mainnet",
      "replyTo": "connection-request-001",
      "payload": {
        "status": "pending"
      }
    },
    "expected": {
      "result": "reject",
      "reason": "invalid-standard-value",
      "path": "/payload/status"
    }
  },
  {
    "id": "reject-rejected-response-with-address",
    "input": {
      "version": 1,
      "type": "connection-response",
      "chain": "symbol",
      "network": "mainnet",
      "replyTo": "connection-request-001",
      "payload": {
        "status": "rejected",
        "address": "X"
      }
    },
    "expected": {
      "result": "reject",
      "reason": "invalid-payload",
      "path": "/payload/address"
    }
  },
  {
    "id": "reject-sign-response-missing-reply-to",
    "input": {
      "version": 1,
      "type": "transaction",
      "chain": "symbol",
      "network": "mainnet",
      "payload": {
        "action": "sign-response",
        "payload": "00112233",
        "result": "approved",
        "signature": "aabbccdd"
      }
    },
    "expected": {
      "result": "reject",
      "reason": "missing-required-field",
      "path": "/replyTo"
    }
  },
  {
    "id": "reject-sign-response-approved-without-signature",
    "input": {
      "version": 1,
      "type": "transaction",
      "chain": "symbol",
      "network": "mainnet",
      "replyTo": "tx-symbol-001",
      "payload": {
        "action": "sign-response",
        "payload": "00112233",
        "result": "approved"
      }
    },
    "expected": {
      "result": "reject",
      "reason": "missing-required-field",
      "path": "/payload/signature"
    }
  },
  {
    "id": "reject-sign-response-rejected-with-signature",
    "input": {
      "version": 1,
      "type": "transaction",
      "chain": "symbol",
      "network": "mainnet",
      "replyTo": "tx-symbol-001",
      "payload": {
        "action": "sign-response",
        "payload": "00112233",
        "result": "rejected",
        "signature": "aabbccdd"
      }
    },
    "expected": {
      "result": "reject",
      "reason": "invalid-payload",
      "path": "/payload/signature"
    }
  },
  {
    "id": "reject-custom-payload-not-object",
    "input": {
      "version": 1,
      "type": "com.example.custom",
      "chain": "custom",
      "network": "custom",
      "payload": "not-an-object"
    },
    "expected": {
      "result": "reject",
      "reason": "invalid-payload",
      "path": "/payload"
    }
  }
]
```

### 9.5 標準暗号プロファイルfixture

標準暗号fixtureでは、通常のSNIF JSONにcanonicalizationを導入しない。暗号アルゴリズムそのものを再現可能に検証するため、fixture内の `plaintextJson` を**その記載どおりのUTF-8 byte列**として暗号化入力に使用する。`plaintextUtf8Hex` はそのbyte列の診断用表現である。

暗号fixtureの共通条件は次のとおり。

- password文字列はUnicode正規化を行わずUTF-8へ変換する。
- Argon2idは `version=19`、`memoryCost=65536 KiB`、`timeCost=3`、`parallelism=1`、導出鍵長32 bytesとする。
- AES-256-GCMのnonceは12 bytes、tagは16 bytesとする。
- AADは使用しない。fixture上の `aad: null` は「追加認証データなし」を意味し、wire formatへ `aad` フィールドを追加するものではない。
- `derivedKey` は暗号実装の診断用期待値であり、SNIF wire formatへ格納してはならない。
- 実運用の暗号化ではsalt/nonceを固定してはならず、暗号学的に安全な乱数源から生成する。
- 通常の `protect` 処理が乱数を使用するため、新規暗号化結果のciphertext一致を一般のAPI契約とはしない。固定salt/nonceを注入できる暗号層のテストでは完全一致を確認できる。少なくとも復号側は下記 `protectedEnvelope` を受理し、`expectedPayload` と同じ論理値を復元できなければならない。

```json
[
  {
    "id": "crypto-account-aes256gcm-argon2id-001",
    "password": "SNIF test password",
    "plaintextJson": "{\"privateKey\":\"000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f\",\"publicKey\":\"202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f\",\"address\":\"TEST-ACCOUNT-ADDRESS\"}",
    "plaintextUtf8Hex": "7b22707269766174654b6579223a2230303031303230333034303530363037303830393061306230633064306530663130313131323133313431353136313731383139316131623163316431653166222c227075626c69634b6579223a2232303231323232333234323532363237323832393261326232633264326532663330333133323333333433353336333733383339336133623363336433653366222c2261646472657373223a22544553542d4143434f554e542d41444452455353227d",
    "kdf": {
      "name": "argon2id",
      "salt": "000102030405060708090a0b0c0d0e0f",
      "params": {
        "version": 19,
        "memoryCost": 65536,
        "timeCost": 3,
        "parallelism": 1
      },
      "derivedKey": "f2a43d41c09abe1c6b8a8d0c3be445dc846240965f0d5c1147ba6b15f768150c"
    },
    "cipher": {
      "name": "aes-256-gcm",
      "nonce": "101112131415161718191a1b",
      "aad": null,
      "ciphertext": "43bc5c40dad1346b831c8c26659cd0900d08c6e38a818ab314475ad9281b1f7ca212b6a71a4d52a5ee3c48a1d0de10eb9c32439a12103cedfcdb96a2de58617fb60a88bb11756262732b44a3fa5065ecba5947b3110026612f67ff6aa54159232a3d91f4a88d767c8de54a175f92f7c0af871dd86da9cd9fa97fcded2b44845970064f581c47599b05690aff54d21a3cf9774b3d86e620b560726e5224a53aee9cae361f71ca352f1ce3fcac55b363065304dfcad0a1965c97189c203c17c1307c",
      "tag": "1aa6921f91c515e71e56bbc42ab8380e"
    },
    "protectedEnvelope": {
      "version": 1,
      "type": "account",
      "chain": "symbol",
      "network": "mainnet",
      "protectedPayload": {
        "cipher": "aes-256-gcm",
        "kdf": {
          "name": "argon2id",
          "salt": "000102030405060708090a0b0c0d0e0f",
          "params": {
            "version": 19,
            "memoryCost": 65536,
            "timeCost": 3,
            "parallelism": 1
          }
        },
        "nonce": "101112131415161718191a1b",
        "ciphertext": "43bc5c40dad1346b831c8c26659cd0900d08c6e38a818ab314475ad9281b1f7ca212b6a71a4d52a5ee3c48a1d0de10eb9c32439a12103cedfcdb96a2de58617fb60a88bb11756262732b44a3fa5065ecba5947b3110026612f67ff6aa54159232a3d91f4a88d767c8de54a175f92f7c0af871dd86da9cd9fa97fcded2b44845970064f581c47599b05690aff54d21a3cf9774b3d86e620b560726e5224a53aee9cae361f71ca352f1ce3fcac55b363065304dfcad0a1965c97189c203c17c1307c",
        "tag": "1aa6921f91c515e71e56bbc42ab8380e"
      }
    },
    "expectedPayload": {
      "privateKey": "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
      "publicKey": "202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f",
      "address": "TEST-ACCOUNT-ADDRESS"
    }
  },
  {
    "id": "crypto-mnemonic-aes256gcm-argon2id-001",
    "password": "SNIF test password",
    "plaintextJson": "{\"mnemonic\":\"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about\"}",
    "plaintextUtf8Hex": "7b226d6e656d6f6e6963223a226162616e646f6e206162616e646f6e206162616e646f6e206162616e646f6e206162616e646f6e206162616e646f6e206162616e646f6e206162616e646f6e206162616e646f6e206162616e646f6e206162616e646f6e2061626f7574227d",
    "kdf": {
      "name": "argon2id",
      "salt": "000102030405060708090a0b0c0d0e0f",
      "params": {
        "version": 19,
        "memoryCost": 65536,
        "timeCost": 3,
        "parallelism": 1
      },
      "derivedKey": "f2a43d41c09abe1c6b8a8d0c3be445dc846240965f0d5c1147ba6b15f768150c"
    },
    "cipher": {
      "name": "aes-256-gcm",
      "nonce": "202122232425262728292a2b",
      "aad": null,
      "ciphertext": "933f8a5edd26f57173d29a7726e249302ddf0f2b6406d1183467ca6ff99254be5ddc56063255ee2f478507547510ca5898bc8900c80025a879ddfb246e8b7812bdc38e25b0011ebd99e5854387d2e09186ebbf3899a190ee6d66618fcbe139f5a6c756fac6b10fa749ee3ef7",
      "tag": "1cc26537e2e304041e9fb62447a04f1d"
    },
    "protectedEnvelope": {
      "version": 1,
      "type": "mnemonic",
      "chain": "symbol",
      "network": "mainnet",
      "protectedPayload": {
        "cipher": "aes-256-gcm",
        "kdf": {
          "name": "argon2id",
          "salt": "000102030405060708090a0b0c0d0e0f",
          "params": {
            "version": 19,
            "memoryCost": 65536,
            "timeCost": 3,
            "parallelism": 1
          }
        },
        "nonce": "202122232425262728292a2b",
        "ciphertext": "933f8a5edd26f57173d29a7726e249302ddf0f2b6406d1183467ca6ff99254be5ddc56063255ee2f478507547510ca5898bc8900c80025a879ddfb246e8b7812bdc38e25b0011ebd99e5854387d2e09186ebbf3899a190ee6d66618fcbe139f5a6c756fac6b10fa749ee3ef7",
        "tag": "1cc26537e2e304041e9fb62447a04f1d"
      }
    },
    "expectedPayload": {
      "mnemonic": "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
    }
  }
]
```

#### 9.5.1 認証失敗・復号後payload不正fixture

標準暗号プロファイルの失敗fixtureでは、`expected.result` が `reject` である入力を定義する。`authentication-failed` はAES-GCMの認証に失敗したこと、`invalid-decrypted-payload` は認証には成功したが復号後payloadが対応する標準typeの形式条件を満たさないことを表すfixture上の分類であり、ライブラリAPIの公開error codeを規定しない。

```json
[
  {
    "id": "crypto-account-aes256gcm-argon2id-tampered-tag-001",
    "password": "SNIF test password",
    "protectedEnvelope": {
      "version": 1,
      "type": "account",
      "chain": "symbol",
      "network": "mainnet",
      "protectedPayload": {
        "cipher": "aes-256-gcm",
        "kdf": {
          "name": "argon2id",
          "salt": "000102030405060708090a0b0c0d0e0f",
          "params": {
            "version": 19,
            "memoryCost": 65536,
            "timeCost": 3,
            "parallelism": 1
          }
        },
        "nonce": "101112131415161718191a1b",
        "ciphertext": "43bc5c40dad1346b831c8c26659cd0900d08c6e38a818ab314475ad9281b1f7ca212b6a71a4d52a5ee3c48a1d0de10eb9c32439a12103cedfcdb96a2de58617fb60a88bb11756262732b44a3fa5065ecba5947b3110026612f67ff6aa54159232a3d91f4a88d767c8de54a175f92f7c0af871dd86da9cd9fa97fcded2b44845970064f581c47599b05690aff54d21a3cf9774b3d86e620b560726e5224a53aee9cae361f71ca352f1ce3fcac55b363065304dfcad0a1965c97189c203c17c1307c",
        "tag": "1aa6921f91c515e71e56bbc42ab8380f"
      }
    },
    "expected": {
      "result": "reject",
      "reason": "authentication-failed"
    }
  },
  {
    "id": "crypto-account-aes256gcm-argon2id-invalid-decrypted-payload-001",
    "password": "SNIF test password",
    "plaintextJson": "{\"unexpected\":\"value\"}",
    "plaintextUtf8Hex": "7b22756e6578706563746564223a2276616c7565227d",
    "kdf": {
      "name": "argon2id",
      "salt": "000102030405060708090a0b0c0d0e0f",
      "params": {
        "version": 19,
        "memoryCost": 65536,
        "timeCost": 3,
        "parallelism": 1
      },
      "derivedKey": "f2a43d41c09abe1c6b8a8d0c3be445dc846240965f0d5c1147ba6b15f768150c"
    },
    "cipher": {
      "name": "aes-256-gcm",
      "nonce": "303132333435363738393a3b",
      "aad": null,
      "ciphertext": "9a34577031f25134b493509fe044b494a2901029ab91",
      "tag": "c1ad2c874bd7bd0314570ffd2a721803"
    },
    "protectedEnvelope": {
      "version": 1,
      "type": "account",
      "chain": "symbol",
      "network": "mainnet",
      "protectedPayload": {
        "cipher": "aes-256-gcm",
        "kdf": {
          "name": "argon2id",
          "salt": "000102030405060708090a0b0c0d0e0f",
          "params": {
            "version": 19,
            "memoryCost": 65536,
            "timeCost": 3,
            "parallelism": 1
          }
        },
        "nonce": "303132333435363738393a3b",
        "ciphertext": "9a34577031f25134b493509fe044b494a2901029ab91",
        "tag": "c1ad2c874bd7bd0314570ffd2a721803"
      }
    },
    "expected": {
      "result": "reject",
      "reason": "invalid-decrypted-payload"
    }
  }
]
```

### 9.6 fixtureの変更規則

- v1の既存fixtureの入力または期待結果を変更すると、既存実装の適合判定が変化するため、誤記訂正を除き原則として行わない。
- 新しい境界条件を追加する場合は、新しいfixture IDを追加する。
- 標準暗号プロファイルの生成時推奨パラメータを将来変更しても、既存暗号fixtureは旧データ復号互換性確認のため保持する。
- fixtureのJSON文字列そのものの空白・インデント・プロパティ順は、暗号fixtureの `plaintextJson` を除いて適合判定対象としない。
