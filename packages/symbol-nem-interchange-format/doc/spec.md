# Symbol/NEM Interchange Format (SNIF) v1

ステータス: Draft

パッケージ識別子: `@nemnesia/snif`

MIME Type: `application/vnd.nemnesia.snif+json`

## 1. 概要

Symbol/NEM Interchange Format (SNIF) は、Symbol、NEM、およびチェーン非依存のデータを、アプリケーション、ウォレット、署名アプリ、バックアップアプリ、および搬送層の間で交換するためのJSON形式である。

SNIF v1のwireは、UTF-8で表現された1個のJSON objectだけである。CBOR wire、JSONとCBORの併存、CBORからの自動変換、binary wrapper、および `snif1:` 表現はv1に含めない。QR画像、ファイル、NFC、Deep Link、Clipboard、HTTP、WebSocket、Bluetooth、Relayなどの搬送方法も定義しない。

SNIFのdecode成功は、JSON構文、型、構造、サイズ、正規化、および必要な暗号認証を満たしたことだけを示す。送信者の本人性、アプリケーションの真正性、接続状態、権限付与、利用者の承認、署名、トランザクションの意味的妥当性、オンチェーンの有効性、または搬送路の安全性を示さない。

### 1.1 規範用語

`MUST`、`MUST NOT`、`SHOULD`、`SHOULD NOT`、`MAY` は規範要件を示す。実装が対応しないタイプを、別のタイプとして解釈してはならない。

### 1.2 責任境界

| 責務      | SNIFの責務                                                  | SNIF外の責務                                       |
| --------- | ----------------------------------------------------------- | -------------------------------------------------- |
| 形式      | JSON、envelope、payload、型、長さ、正規化、構造検証         | 業務上・チェーン上の意味検証                       |
| 暗号      | v1暗号profileの構造、鍵導出、認証付き暗号、暗号入力の固定   | 秘密情報の保存、鍵管理、利用者への警告             |
| 要求/応答 | `requestId`、要求・応答のデータ構造、単一document内の整合性 | 期限の現在時刻比較、replay防止、状態遷移、承認判断 |
| 接続      | 接続要求・応答のJSON表現                                    | セッション、認可、失効、送信者認証                 |
| 搬送      | 完全なSNIF JSON text                                        | QR、通信、再送、通信路認証、分割・再構成           |

SNIF codecは、外部ストレージ、Cookie、データベース、セッション状態、permission state、監査状態、ノードへアクセスしてはならない。

## 2. 用語と設計原則

| 用語             | 定義                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------- |
| JSON wire        | UTF-8 JSON textで表現された、SNIF v1の完全なenvelope                                     |
| envelope         | `protocol`、`version`、`type`、`chain`、`network`、`options`、`payload`を持つJSON object |
| payload          | type固有のJSON object、または暗号化時のciphertextを表すbyte文字列                        |
| byte文字列       | `hex:` 接頭辞と大文字16進数で表す文字列                                                  |
| canonical JSON   | digest、暗号、AADの入力を固定するための内部JSON serialization                            |
| codec            | JSON wireと検証済みdocumentを変換する、外部状態を変更しない処理                          |
| requestId        | 要求と応答を対応付ける、意味を持たない不透明な識別子                                     |
| display metadata | `name`、`origin`、`iconUrl`、`purpose`などの自己申告表示情報                             |

次の原則を適用する。

- 公開情報交換、接続状態、permission grantを別の意味として扱う。`contact`を接続承認の代替にしてはならない。
- `origin`、`iconUrl`、アプリケーション名、`purpose`は自己申告の表示情報であり、認証、本人性、ドメイン所有、信頼の根拠にしてはならない。
- `chain`と`network`は共通envelopeで一度だけ表現する。payloadへ複製してはならない。
- 未知のversion、type、必須機能、暗号方式、permission、fieldを推測して受理してはならない。
- JSON wireのproperty順と空白は意味に影響しない。重複key、型、数値、文字列、構造の規則は意味同値性の一部として検証する。
- wire JSONの表現と、暗号・digestに使用するcanonical JSONを混同してはならない。

## 3. 共通データモデル

### 3.1 envelope

envelopeは次の7 fieldを必須とする。追加fieldはv1で禁止する。

```text
SnifEnvelope = {
  protocol: "snif",
  version: 1,
  type: FormatType,
  chain: Chain,
  network: Network,
  options: Options,
  payload: PlainPayload | HexString,
}
```

`PlainPayload` は `type` に対応する次のいずれかのpayload objectである。

```text
PlainPayload = AddressPayload | ContactPayload | AccountPayload | MnemonicPayload
             | TransactionRequestPayload | ConnectionRequestPayload
             | ConnectionResponsePayload | SigningRequestPayload
             | SigningResponsePayload | ObjectPayload
```

`FormatType` は次のいずれかである。

```text
"address" | "contact" | "account" | "mnemonic"
| "transaction-request" | "connection-request" | "connection-response"
| "signing-request" | "signing-response" | "object"
```

平文payloadはtypeに対応するJSON objectでなければならない。暗号化payloadは `HexString` でなければならず、復号後にtypeに対応するpayload JSONを得なければならない。

`chain: "none"` はチェーン非依存の `object` だけに許可する。その他のtypeは `symbol` または `nem` を要求する。

### 3.2 network

```text
SymbolNetwork = {
  id: integer 0..255,
  generationHashSeed: HexString(bytes=32),
}

NemNetwork = {
  id: integer -128..127,
}

NoneNetwork = { id: 0 }
Network = SymbolNetwork | NemNetwork | NoneNetwork
```

Symbolでは `id` と `generationHashSeed` の組をnetwork識別子とする。NEMでは `id` を符号付き8-bit整数として扱い、main network `104`、test network `-104`、および対象環境が明示的にサポートするprivate network値を区別する。

NEMのSNIF `network.id` はJSONの論理整数であり、raw network byteではない。NEMアドレスのraw byteへ変換する場合は `id < 0 ? id + 256 : id`、raw byteから戻す場合は最上位bitが1なら `byte - 256` とする。main networkは論理値 `104` / raw byte `0x68`、test networkは論理値 `-104` / raw byte `0x98` である。raw byte値 `152` をSNIFの `network.id` として受理してはならない。

codecはnetwork objectの型、範囲、chainとの組合せを検証する。Symbolのgeneration hash、NEMのnetwork値のオンチェーン上の意味、およびアドレスとの整合性はhostまたは対象チェーンの検証層で確認する。

### 3.3 options

```text
Options = {
  integrity: { algorithm: "sha3-256", digest: HexString(bytes=32) }
           | { algorithm: "aead" },
  encryption: { algorithm: "none" }
             | { algorithm: "password-v1",
                 salt: HexString(bytes=16),
                 nonce: HexString(bytes=12) },
}
```

平文payloadでは `integrity.algorithm` は `sha3-256`、`encryption.algorithm` は `none` でなければならない。暗号化payloadでは `integrity.algorithm` は `aead`、`encryption.algorithm` は `password-v1` でなければならない。平文payloadに `aead`、暗号化payloadに `sha3-256` を指定してはならない。

### 3.4 JSON共通規則

受信側は、入力をUTF-8 JSONとして解析する。BOM、最上位配列、最上位primitive、空入力、末尾の余分なJSON valueを拒否する。JSON parserは重複keyを検出して拒否しなければならない。parserのlast-winsまたはfirst-wins動作を利用してはならない。

v1では次を禁止する。

- `null`、JSON boolean以外の未定義値、浮動小数、非有限数。
- 整数でない数値、指数表記、`-0`、安全な整数範囲外の数値。
- 未知field、未知type、未知option、未知permission。
- 文字列型byte値、通常fieldにおける配列型byte値。

JSONのproperty順と空白は受理結果に影響しない。送信側は任意のproperty順とJSON whitespaceを使用してよいが、同じ論理値を複数の意味で表す数値表記を生成してはならない。

通常の文字列は正しいUTF-8、Unicode NFC、空文字列禁止とする。受信側はNFCを暗黙に適用してはならず、NFCでない入力を拒否する。表示文字列ではU+0000〜U+001FおよびU+007Fを禁止する。URIはRFC 3986 absolute-URIとする。

`HexString` は `hex:` 接頭辞の後ろに、0〜許容最大byte数の偶数個の大文字16進数を持つ。`hex:` だけ、奇数桁、小文字、空白、`0x` 接頭辞、Base64文字列を受理してはならない。schemaでbyte長が指定される場合はdecoded byte lengthを検証する。

`object` payload内のbyte値は、通常文字列と区別するため次のobjectだけで表す。

```json
{ "$bytes": "hex:0011AABB" }
```

このwrapperは `$bytes` 以外のfieldを持ってはならない。通常文字列の値が偶然 `hex:` で始まってもbyte値として解釈してはならない。

本文中の `Text(n..m bytes)` は、共通文字列規則を満たすUTF-8文字列で、decoded UTF-8 byte lengthが範囲内であることを示す。`DisplayText` は表示文字列の制御文字禁止を追加し、`URIText` はabsolute-URI制約を追加する。`integer` はJSONのsafe-integer範囲内の整数、`SafeInteger` は同じ範囲のAPI値を示す。

## 4. JSON wireとcanonical JSON

### 4.1 wire JSON

JSON wireは、section 3のenvelopeをUTF-8 JSON textとして表現したものである。JSON objectのproperty順、配列以外の空白、改行は自由である。wireのcanonical text表現は定義しない。

`encode` は検証済みdocumentをJSON textへ変換し、`decode` はJSON textまたはUTF-8 bytesをdocumentへ変換する。`encodeText`、`decodeText`、`snif1:` prefix、Base64URL表現、payload単体表現はv1に存在しない。

### 4.2 内部canonical JSON

digest、password-v1のplaintext、AADに使用するserializationは、wire textとは別のSNIF内部canonical JSONとする。

- RFC 8785 JSON Canonicalization Scheme (JCS) の規則を使用する。ただし、v1で禁止したJSON型は対象外とする。
- UTF-8で表現する。
- propertyをcanonical順に並べる。
- JSON whitespaceを出力しない。
- v1で許可された整数だけを対象とし、浮動小数・`null`・未知値は対象にしない。
- byte値はwireと同じ `HexString` または `$bytes` wrapperの文字列としてcanonicalizeする。

canonical JSONはwire入力そのものを要求するものではない。property順や空白だけが異なるwire JSONは、同じ論理documentとして同じcanonical JSONへ変換される。

### 4.3 encode

送信側は次の順序で処理する。

```text
JSON document validation
  -> canonical JSON(payload)
  -> SHA3-256 integrity or password-v1 AEAD
  -> JSON envelope construction
  -> UTF-8 JSON serialization
```

平文payloadでは、`options.integrity.digest` にcanonical payload UTF-8 bytesのFIPS 202 SHA3-256を設定する。暗号化payloadでは、canonical payload UTF-8 bytesを暗号化し、`payload`へciphertextとauthentication tagを連結した `HexString` を設定する。

AADは、`payload` fieldを除いたenvelope objectをcanonical JSON化したUTF-8 bytesである。AADへ暗号文、digest、password、導出鍵を追加してはならない。

### 4.4 decode

受信側は次の順序で処理する。

1. 入力byte長とUTF-8を確認する。
2. JSON構文、重複key、最上位型、末尾データ、resource limitを確認する。
3. protocol、version、type、chain、network、optionsのschemaと組合せを確認する。
4. payloadのplain/encrypted形式、byte長、typeとの対応を確認する。
5. 暗号化されている場合は認証・復号を完了する。認証前の平文をdecode、表示、ログ出力してはならない。
6. 平文payloadの場合はcanonical payload bytesを再生成してSHA3-256 digestを検証する。
7. 復号または平文payloadのJSON schema、resource limit、Unicode、byte表現を確認する。
8. document内のchain、network、payload、permission、requestIdの構造整合性を確認する。

元request、現在時刻、期限、replay状態を必要とする検証はdecodeに含めない。

### 4.5 inspect

`inspect` はJSON構文、envelopeの構造、version、type、chain、network、optionsだけを検証し、payloadのdigest検証、復号、payload schema検証を行わない。成功はpayloadの妥当性を示さない。

```ts
type SnifHeader = {
  protocol: 'snif';
  version: 1;
  type: FormatType;
  chain: Chain;
  network: Network;
  options: Options;
};
```

## 5. 標準payload

### 5.1 address

```text
AddressPayload = { address: HexString }
```

Symbol addressは24 bytes、NEM addressは25 bytesとする。codecは長さとchainとの対応だけを検証し、checksum、network byte、Base32表現、およびオンチェーン上の存在を検証しない。

### 5.2 contact

```text
ContactPayload = {
  name: DisplayText(1..128 bytes),
  address: HexString,
  publicKey?: HexString(bytes=32),
}
```

`contact` は公開情報交換だけを表す。接続、permission grant、所有証明、本人性証明を表さない。`publicKey`が存在する場合、walletまたはhostはenvelopeのchain/networkに従ってaddressとの整合性を別途検証する。

### 5.3 account

```text
AccountPayload = {
  privateKey: HexString(bytes=32),
  publicKey: HexString(bytes=32),
  address: HexString,
}
```

`account` はpassword未指定なら平文、password指定なら `password-v1` で暗号化する。平文accountのencodeおよびdecodeを許可するが、平文は秘密性、保存安全性、搬送安全性を持つものとして扱ってはならない。復号後または平文decode後のhostは秘密鍵から公開鍵を、公開鍵とnetworkからaddressを導出して整合性を検証し、不一致時は秘密情報を利用者へ返してはならない。codecはこの導出を行わない。

### 5.4 mnemonic

```text
MnemonicPayload = {
  scheme: "bip39",
  language: "english" | "japanese" | "korean" | "spanish"
           | "chinese-simplified" | "chinese-traditional"
           | "french" | "italian" | "czech" | "portuguese",
  mnemonic: Text(1..1024 bytes),
  passphrase?: Text(0..1024 bytes),
}
```

`mnemonic` と `passphrase` はUnicode NFKD、単語間はASCII space 1文字とする。暗号化用passwordとBIP39 passphraseを同一視してはならない。codecは単語list、checksum、seed、chain別鍵導出を検証しない。平文mnemonicのencodeおよびdecodeを許可するが、平文の秘密性、保存安全性、搬送安全性は保証しない。

### 5.5 transaction-request

```text
TransactionRequestPayload = {
  requestId: HexString(bytes=16),
  transactionPayload: HexString(1..8388608 bytes),
}
```

`transactionPayload` は対象chainの完全なシリアライズ済みtransaction byte列を不透明に格納する。codecはtransaction type、fee、deadline、recipient、mosaic、message、signature、hash、署名可能性、またはオンチェーン有効性を検証しない。

### 5.6 connection-request

```text
ConnectionRequestPayload = {
  application: {
    name: DisplayText(1..128 bytes),
    origin: URIText(1..2048 bytes),
    iconUrl?: URIText(1..2048 bytes),
  },
  permissions: Permission[],
  requestId: HexString(bytes=16),
}

Permission = "account" | "sign-transaction" | "sign-message"
```

`permissions` は1〜3要素、重複禁止、未知値禁止とする。canonical順序は `account`、`sign-transaction`、`sign-message` の順であり、含まれるpermissionをこの順序で並べなければならない。codecは順序を暗黙に並べ替えてはならない。`requestId` は全zeroを禁止し、生成側は暗号学的に安全な乱数を使用する。

`origin` と `iconUrl` はabsolute URIで、自己申告表示情報である。SNIF codecはiconUrlを取得してはならない。

### 5.7 connection-response

```text
ConnectionResponsePayload =
  | {
      approved: true,
      requestId: HexString(bytes=16),
      account: { address: HexString, publicKey: HexString(bytes=32) },
      permissions: ["account", PermissionWithoutAccount{0..2}],
    }
  | {
      approved: true,
      requestId: HexString(bytes=16),
      permissions: [PermissionWithoutAccount{1..2}],
    }
  | {
      approved: false,
      requestId: HexString(bytes=16),
    }

PermissionWithoutAccount = "sign-transaction" | "sign-message"
```

承認responseのpermissionは、対応する要求のpermissionの部分集合でなければならない。要求にないpermission、未知のpermission、重複permission、canonical順序でない配列を承認してはならない。

`account` permissionを許可する場合は、配列の先頭を `account` とし、`account` fieldを必須とする。`account` permissionを許可しない場合は、permission配列およびpayloadへ `account` を含めてはならない。要求とのsubset、requestId一致、期限、replayの検証はhost/context検証の責務である。

### 5.8 signing-request

```text
SigningRequestPayload = {
  requestId: HexString(bytes=16),
  signingType: "transaction" | "message",
  payload: HexString(0..8388608 bytes),
  purpose?: DisplayText(1..256 bytes),
  expectedSignerPublicKey?: HexString(bytes=32),
}
```

`signingType: "transaction"` のpayloadは1〜8 MiB、`signingType: "message"` のpayloadは0〜1 MiBとする。messageでは `purpose` を必須とする。`purpose` は表示用情報、`payload` は署名対象byte列であり、両者は別fieldである。codecは表示内容と署名対象の意味的一致、署名者、domain separation、期限、replay、元requestとの業務上の対応を検証しない。

### 5.9 signing-response

```text
SigningResponsePayload =
  | {
      approved: true,
      requestId: HexString(bytes=16),
      signature: HexString(bytes=64),
      signerPublicKey: HexString(bytes=32),
    }
  | {
      approved: false,
      requestId: HexString(bytes=16),
    }
```

拒否responseはrequestId以外の署名材料を含めてはならない。codecはsignature検証、signerPublicKeyの所有、署名対象との対応を検証しない。

### 5.10 object

```text
ObjectPayload = { value: ObjectValue }

ObjectValue = boolean | safe-integer | Text | ByteWrapper
            | ObjectValue[] | { string: ObjectValue }
ByteWrapper = { "$bytes": HexString }
```

`object` はチェーン非依存の限定された構造化データである。float、null、非文字列object key、未知のbyte wrapper、外部パッケージによるtype登録を許可しない。意味、schema、信頼性は利用側が定義する。

### 5.11 共通payload定義

`requestId` は16 bytesで全zeroを禁止する。`requestId` の生成、衝突回避、再利用防止、応答との対応、および期限policyはhostの責務である。v1のwireには期限fieldを定義しない。SNIFは `requestId` を消費・保存・失効させない。

## 6. 暗号化profile

### 6.1 password-v1

`password-v1` はv1唯一の暗号化profileである。password指定時のすべてのpayloadで使用でき、accountとmnemonicでも任意である。password未指定時は `encryption.algorithm: "none"` の平文payloadを使用する。公開鍵暗号、鍵合意、接続応答の暗号化はv1対象外とする。

passwordがstringの場合、UTF-8 bytesへ変換し、trim、大文字小文字変換、Unicode正規化を行わない。passwordが `Uint8Array` の場合、そのbyte列をそのままpassword bytesとして扱う。空passwordは拒否し、いずれの入力形式も1,024 bytesを超えてはならない。stringと同値なbyte列以外を、暗黙に同値と扱ってはならない。

### 6.2 KDF

Argon2id RFC 9106を次の固定値で使用して32-byte鍵を導出する。

| parameter                |                    value |
| ------------------------ | -----------------------: |
| memory                   |               65,536 KiB |
| iterations               |                        3 |
| parallelism              |                        4 |
| output length            |                       32 |
| version                  |                   `0x13` |
| secret / associated data |                    empty |
| salt                     | CSPRNGで生成した16 bytes |

KDF parameterを攻撃者制御のJSON fieldにしてはならない。将来変更する場合は新しいencryption profileを定義する。

### 6.3 AES-GCM

導出鍵でAES-256-GCMを使用する。nonceは毎回CSPRNGで生成した12 bytes、authentication tagは16 bytesとする。暗号payloadは `ciphertext || authentication-tag` のbyte列を `HexString` として格納する。AADはsection 4.2で定義した、payloadを除くenvelopeのcanonical JSON UTF-8 bytesである。

通常APIはsaltまたはnonceを呼び出し側から受け取ってはならない。固定salt、nonce、導出鍵の注入は適合fixture専用に限定する。

### 6.4 復号失敗

暗号化payloadに対するpassword未指定は `password-required`、password不一致、ciphertext破損、AAD不一致、tag不一致はすべて `decryption-failed` とする。平文accountまたはmnemonicに対してpasswordがないことはエラーではない。詳細な失敗理由を外部へ返してはならない。

認証完了前に復号済みpayloadをdecode、展開、表示、ログ出力してはならない。秘密情報を含むbufferは不要になった時点でbest effortによりzeroizeする。ただしGC、JIT、swap、core dump内の完全消去は保証しない。

## 7. 実行環境とprovider境界

### 7.1 対応環境

v1の参照実装はNode.js 20以上、Web Crypto・AbortSignal・BigIntを提供する現行ブラウザおよびmodule Worker、ならびに必要な暗号providerを初期化したReact NativeおよびExpoを対象とする。

SNIF coreはNode.js built-in、filesystem、DOM、window、localStorage、native moduleを直接参照してはならない。公開形式はruntime-neutralなESM APIとし、環境差をwire形式へ混入させない。

### 7.2 provider API

```ts
interface SnifCryptoProvider {
  randomBytes(length: number): Promise<Uint8Array>;
  deriveArgon2id(input: {
    password: Uint8Array;
    salt: Uint8Array;
    memoryKiB: 65536;
    iterations: 3;
    parallelism: 4;
    outputLength: 32;
    version: 0x13;
  }): Promise<Uint8Array>;
  encryptAes256Gcm(input: {
    key: Uint8Array;
    nonce: Uint8Array;
    plaintext: Uint8Array;
    aad: Uint8Array;
  }): Promise<Uint8Array>;
  decryptAes256Gcm(input: {
    key: Uint8Array;
    nonce: Uint8Array;
    ciphertextAndTag: Uint8Array;
    aad: Uint8Array;
  }): Promise<Uint8Array>;
}
```

providerは指定長以外の乱数、暗号認証失敗、処理中断を定義済みerrorへ変換する。非暗号学的乱数、時刻、固定値へのfallbackを禁止する。runtimeごとのKDF同時実行数、memory確保量、AbortSignal処理は制限してよいが、wire値、KDF値、error categoryを変更してはならない。

## 8. 公開API

```ts
type Chain = 'symbol' | 'nem' | 'none';
type HexString = string; // runtime validation: hex: + uppercase even-length hex
type SafeInteger = number;
type FormatType =
  | 'address'
  | 'contact'
  | 'account'
  | 'mnemonic'
  | 'transaction-request'
  | 'connection-request'
  | 'connection-response'
  | 'signing-request'
  | 'signing-response'
  | 'object';

type PayloadByType = {
  address: AddressPayload;
  contact: ContactPayload;
  account: AccountPayload;
  mnemonic: MnemonicPayload;
  'transaction-request': TransactionRequestPayload;
  'connection-request': ConnectionRequestPayload;
  'connection-response': ConnectionResponsePayload;
  'signing-request': SigningRequestPayload;
  'signing-response': SigningResponsePayload;
  object: ObjectPayload;
};

type SnifDocument = {
  [T in FormatType]: {
    protocol: 'snif';
    version: 1;
    type: T;
    chain: Chain;
    network: Network;
    options: Options;
    payload: PayloadByType[T] | HexString;
  };
}[FormatType];

type Password = string | Uint8Array;

interface EncodeOptions {
  password?: Password;
  signal?: AbortSignal;
}

interface DecodeOptions {
  password?: Password;
  signal?: AbortSignal;
}

interface HostContext {
  now: SafeInteger;
  requestValidUntil: SafeInteger;
  replayState: 'unseen' | 'seen';
}

interface SnifCodec {
  encode(document: SnifDocument, options?: EncodeOptions): Promise<string>;
  decode(data: string | Uint8Array, options?: DecodeOptions): Promise<SnifDocument>;
  inspect(data: string | Uint8Array): SnifHeader;
  validateContext(request: SnifDocument, response: SnifDocument, context: HostContext): void;
}

type SnifErrorCode =
  | 'invalid-json'
  | 'invalid-envelope'
  | 'unsupported-version'
  | 'unsupported-type'
  | 'unsupported-codec'
  | 'password-required'
  | 'decryption-failed'
  | 'invalid-payload'
  | 'invalid-context'
  | 'resource-limit'
  | 'operation-cancelled'
  | 'entropy-unavailable'
  | 'provider-unavailable';

type SnifError = {
  code: SnifErrorCode;
  message?: string;
};

declare function createSnifCodec(options: { cryptoProvider: SnifCryptoProvider }): SnifCodec;
```

`createSnifCodec` はproviderを保持するcodec instanceを返す。`encode`、`decode`、`inspect`は外部状態を変更してはならない。入力の `Uint8Array` を無断で変更してはならない。秘密payloadをdecodeした場合、その後の消去責任は呼び出し側へ移る。

`validateContext` は明示的に渡されたrequest、response、host contextだけを使用する純粋な検証であり、現在時刻、期限、replay store、接続状態を外部から取得してはならない。codecの通常decodeはこれを自動実行しない。requestId一致、response permissionのsubset、期限、replay状態を検証し、失敗時は `invalid-context` を返す。

公開APIの失敗は `SnifError` をthrowまたはrejectする。`code` は必須で、`message` は利用者向けの一般的な説明に限る。provider固有exceptionをそのまま公開してはならない。

公開型はwire schemaの入力支援に過ぎず、型だけでbyte長、正規化、chain/network整合性、暗号認証を保証してはならない。runtime validationを必須とする。

## 9. エラー仕様

公式実装はparser固有messageと別に、次の機械判定可能なcodeを公開する。

| code                   | 発生条件                                                             |
| ---------------------- | -------------------------------------------------------------------- |
| `invalid-json`         | UTF-8、JSON構文、重複key、最上位型、末尾データが不正                 |
| `invalid-envelope`     | 必須field、未知field、型、options、chain/network、envelope構造が不正 |
| `unsupported-version`  | protocolはsnifだがversionが未対応                                    |
| `unsupported-type`     | versionは対応するがtypeを実装していない                              |
| `unsupported-codec`    | 暗号profileまたはproviderが未対応                                    |
| `password-required`    | 暗号化payloadにpasswordがない                                        |
| `decryption-failed`    | password、AAD、ciphertext、認証tagの失敗                             |
| `invalid-payload`      | payload schema、byte、正規化、型、列挙値が不正                       |
| `invalid-context`      | permission、requestId、要求・応答、期限、replay条件が不正            |
| `resource-limit`       | JSON、byte、文字列、map、array、nest、KDF resourceの上限超過         |
| `operation-cancelled`  | AbortSignalまたは利用者要求による中断                                |
| `entropy-unavailable`  | CSPRNGが利用不能、失敗、指定長未満を返した                           |
| `provider-unavailable` | 対象runtimeの必須providerが初期化されていない                        |

JSON構文・重複keyは `invalid-json`、envelopeのschema違反は `invalid-envelope`、payloadのschema違反は `invalid-payload` とする。codec単体では元requestを必要とするsubset・対応付け・期限・replay検証を行わず、`validateContext` の失敗だけを `invalid-context` とする。

errorのmessage、cause、ログ、telemetryにpassword、privateKey、mnemonic、復号済みpayload、導出鍵を含めてはならない。

## 10. サイズと資源制限

| 対象                   |                                       最大値 |
| ---------------------- | -------------------------------------------: |
| 完全なJSON UTF-8 bytes |                                       16 MiB |
| decoded payload bytes  |                                       16 MiB |
| JSON nest depth        |                                           16 |
| 1 objectの要素数       |                                           64 |
| 1 arrayの要素数        |                                          256 |
| 一般文字列             |                           UTF-8で1,024 bytes |
| name                   |                             UTF-8で128 bytes |
| origin / iconUrl       |                           UTF-8で2,048 bytes |
| purpose                |                             UTF-8で256 bytes |
| message payload        |                                        1 MiB |
| transaction payload    |                                        8 MiB |
| password               |                                  1,024 bytes |
| Argon2id同時実行       | 実行中1件、待機1件までを参照実装の上限とする |

上限は、攻撃者制御の値を使った大規模なメモリ確保、KDF、復号、JSON decodeの前に適用する。搬送層はこれより小さい上限を適用してよい。環境別の小さい上限によるlocal拒否はwireの適合結果と区別する。

## 11. セキュリティ要件

- privateKey、mnemonic、password、導出鍵、復号済みpayloadをログ、例外、診断出力、clipboard、永続storageへ出力してはならない。
- 外部metadataを認証根拠として扱ってはならない。
- 平文digestを送信者認証と誤認させてはならない。
- accountおよびmnemonicの平文を受理してよいが、安全な保存・搬送または暗号化済みデータとして扱ってはならない。
- unknown permission、要求外permission、重複permissionを承認してはならない。
- 拒否responseにaccount、公開鍵、permission、session情報を含めてはならない。
- chain/networkが一致しないaddress、account、transaction、connection、signing payloadを受理してはならない。
- 未知version、未知type、未知field、未知暗号方式へ暗黙のfallbackをしてはならない。
- KDF、JSON decode、復号、暗号処理のresource limitを回避してはならない。
- requestId、期限、replayをSNIF codec単体で検証済みと扱ってはならない。

## 12. バージョンと互換性

v1の `version` は整数 `1` だけを定義する。v1 decoderは未知field、未知type、未知option、未知permissionを拒否する。未知versionは `unsupported-version` とする。

JSON fieldの意味、byte表現、署名対象、暗号処理、canonical JSON、正規化、許容値、network判定を変更する場合は、新しいwire versionまたは名前付きprofileを定義する。既存v1の意味を実装者判断で変更してはならない。

搬送profileは完全なSNIF JSON textを不透明に扱い、SNIF v1から独立して進化できる。

## 13. 適合fixture要件

fixtureの正本は、将来追加する `doc/fixtures/manifest.json` とmanifestから参照されるfixture本体とする。仕様本文や実装内test constantから期待結果を再生成してはならない。

最低限、次のfixtureカテゴリを用意する。

| category                 | 必須内容                                                                |
| ------------------------ | ----------------------------------------------------------------------- |
| `json-envelope`          | 正常JSON、property順・空白差、重複key、未知field、chain/network分岐     |
| `codec-component-matrix` | 10 typeの正常、境界、不正case、期待documentと期待error                  |
| `password-v1`            | canonical payload、固定password、salt、nonce、AAD、導出鍵、暗号文、改変 |
| `secret-backup`          | account/mnemonicの平文、暗号化、誤password、改変、password欠落          |
| `connection`             | contact分離、未知/重複/要求外permission、subset、拒否時最小開示         |
| `request-response`       | requestId対応、transaction/signing request/response                     |
| `host-context`           | wire外の期限、現在時刻、replay状態、requestId対応に対するhost判定       |
| `resource-limit`         | JSON、byte、文字列、map、array、nest、KDF同時実行の上限                 |
| `unicode`                | NFC/NFKD、ASCII space、passwordの未正規化                               |

正常caseは入力JSON、期待する意味document、canonical payload bytes、必要なdigestまたは暗号入力を持つ。property順や空白が異なる正常wireは同じ意味documentとして受理しなければならない。不正caseは指定されたerror codeで失敗しなければならない。

暗号fixtureは固定password、salt、nonce、AAD、導出鍵、ciphertext、tagを持つ。通常APIは固定salt、nonce、導出鍵を受け取らず、fixture providerだけが注入する。秘密情報を含むfixtureは実運用値を使用してはならない。

`host-context` fixtureはSNIF wire外の次のJSONを持つ。

```json
{
  "requestFixture": "connection-request-valid",
  "responseFixture": "connection-response-valid",
  "now": 1700000000,
  "requestValidUntil": 1700000060,
  "replayState": "unseen",
  "expected": "accept"
}
```

`requestFixture` と `responseFixture` はwire fixtureへの参照、`now` と `requestValidUntil` はhostが管理するUTC Unix秒、`replayState` は `unseen` または `seen`、`expected` は `accept` または `reject` とする。requestIdが一致し、`replayState` が `unseen` で、`now < requestValidUntil` の場合だけ `accept` を期待する。それ以外は `reject` とする。期限値はhost-contextにのみ存在し、SNIF envelopeまたはpayloadへ追加してはならない。

connectionの最低限の正常fixtureは、`["account"]`、`["account", "sign-transaction"]`、`["account", "sign-message"]`、`["account", "sign-transaction", "sign-message"]`、`["sign-transaction"]`、`["sign-message"]`、`["sign-transaction", "sign-message"]` とする。逆順、重複、未知、account field不一致、account欠落、要求外permission、requestId不一致、期限切れ、replay済みを拒否fixtureとする。

## 14. 要件・レビューとの追跡

| 対象                   | 本仕様での対応                                                |
| ---------------------- | ------------------------------------------------------------- |
| FR-001〜FR-006         | sections 3, 4, 9, 10, 12                                      |
| FR-007〜FR-012         | sections 3, 4, 6, 10, 11                                      |
| FR-009, AC-007         | sections 5.3, 5.4, 6, 8, 9, 11, 13                            |
| FR-011, AC-001, AC-018 | sections 1, 4, 8, 13                                          |
| FR-013〜FR-017         | sections 2, 5.2, 5.6, 5.7, 8, 11                              |
| FR-018〜FR-020         | sections 5.5, 5.8, 5.9, 12                                    |
| FR-019, AC-010〜AC-013 | sections 5.7, 8, 13                                           |
| SEC-001〜SEC-008       | sections 6, 7, 9, 10, 11                                      |
| NFR-001〜NFR-008       | sections 3, 4, 7, 8, 13                                       |
| AC-001〜AC-018         | sections 13および各typeのschema/検証規則                      |
| RR-001                 | sections 4, 9, 10, 13。wire結果とlocal resource拒否を分離     |
| RR-002                 | sections 3, 4, 6, 9, 11。保証単位を分離                       |
| RR-003                 | sections 5.7, 8, 13。期限・replayをhost-contextへ分離         |
| SR-001                 | sections 5.6, 5.7, 13。permission順序をrequest/responseへ適用 |
| SR-002                 | sections 6.1, 8, 13。password入力bytesを固定                  |
| SR-003                 | sections 4.1, 4.4、8。JSON入力とcanonical性を分離             |
| SR-004                 | sections 5.8。表示情報と署名対象bytesを分離                   |
| SR-005                 | sections 8, 9。公開型とerror objectの契約を定義               |
| SR-006                 | sections 1.2, 5.7, 8, 13。codecとhost/contextを分離           |

### 14.1 要件の未決定事項に対するv1の判断

| 要件ID   | v1での扱い                                                                     |
| -------- | ------------------------------------------------------------------------------ |
| OPEN-001 | JSON意味同値受理、重複key拒否、byteはHexString、canonical JSONを暗号入力に採用 |
| OPEN-002 | `application/vnd.nemnesia.snif+json` と直接JSON text wireを採用                |
| OPEN-003 | password-v1、Argon2id、AES-256-GCM、固定パラメーターを採用                     |
| OPEN-004 | 接続時の鍵合意・応答暗号化はv1対象外                                           |
| OPEN-005 | callback/Relayの通信構造はv1対象外                                             |
| OPEN-006 | 既知permission、不透明16-byte requestId、host-context検証を採用                |
| OPEN-007 | NEM transactionは不透明byte列として扱う                                        |
| OPEN-008 | custom type登録はv1対象外                                                      |
| OPEN-009 | section 10の共通上限とprovider同時実行上限を採用                               |
| OPEN-010 | Node.js、browser、React Native、Expoを対象としprovider境界で環境差を隔離       |

## 15. 参照資料と作成状況

| 種別               | 参照先                                                                                | 用途                                       |
| ------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------ |
| コンセプト         | `packages/symbol-nem-interchange-format/doc/concept-sheet.md`                         | 目的、v1境界、責任分担、JSON方針           |
| コンセプトレビュー | `packages/symbol-nem-interchange-format/doc/reviews/concept-sheet-review-findings.md` | 対象一致、次段階進行判定                   |
| 要件               | `packages/symbol-nem-interchange-format/doc/requirements.md`                          | 機能要件、非機能要件、受入条件、OPEN項目   |
| 要件レビュー       | `packages/symbol-nem-interchange-format/doc/reviews/requirements-review-findings.md`  | RR-001、RR-002、RR-003の対応               |
| Symbol知識資料     | `docs/knowledge/symbol-openapi3.yml:538-548`                                          | transactionの意味・serializationの責任境界 |
| NEM知識資料        | `docs/knowledge/nem-openapi3.yaml:164-170`                                            | 論理network ID `104` / `-104`の表現        |
| NEM SDK資料        | `packages/symbol-sdk/src/nem/Network.js:112-113`                                      | raw byteとSNIF論理値の区分                 |
| 仕様レビュー       | `packages/symbol-nem-interchange-format/doc/reviews/spec-review-findings.md`          | SR-001〜SR-006の入力                       |

コンセプトレビューは「要件定義へ進める」、要件レビューは「仕様設計へ進める」と判定されている。RR-001〜RR-003は本仕様で具体化した。

仕様レビュー結果は対象 `spec.md` と一致し、「仕様の修正を優先する」と判定されていた。本更新でSR-001〜SR-006を、JSON wire、password、署名表示情報、公開API、host/context、fixtureへ反映した。レビュー結果ファイル自体は変更していない。

実装者改善依頼ファイル `.reviews/blockchain-implementation-spec-feedback.md` は確認できず、対象外である。
