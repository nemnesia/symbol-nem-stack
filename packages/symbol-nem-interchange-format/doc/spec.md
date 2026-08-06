# Symbol/NEM Interchange Format (SNIF) v1

ステータス: Draft

パッケージ識別子: `@nemnesia/snif`

MIME Type: `application/vnd.nemnesia.snif+cbor`

## 1. 概要

Symbol/NEM Interchange Format (SNIF) は、Symbol、NEM、およびチェーン非依存のデータを、アプリケーション、ウォレット、署名アプリ、バックアップアプリ、および搬送層の間で交換するための形式である。

SNIFは、データ形式、検証規則、暗号化ペイロード、および要求と応答の構造を定義する。QR画像、ファイル、NFC、Deep Link、Clipboard、HTTP、WebSocket、Bluetooth、Relayなどの搬送方法は定義しない。

SNIFのデコード成功は、形式、型、サイズ、正規化、および暗号認証を満たしたことだけを示す。送信者の本人性、アプリケーションの真正性、接続状態、権限付与、利用者の承認、署名、トランザクションの意味的妥当性、オンチェーンの有効性、または搬送路の安全性を示さない。

### 1.1 規範用語

`MUST`、`MUST NOT`、`SHOULD`、`SHOULD NOT`、`MAY` は規範要件を示す。実装が対応しないタイプを、別のタイプとして解釈してはならない。

### 1.2 責任境界

| 責務      | SNIFの責務                                            | SNIF外の責務                                       |
| --------- | ----------------------------------------------------- | -------------------------------------------------- |
| 形式      | envelope、payload、型、長さ、正規化、決定的エンコード | 業務上・チェーン上の意味検証                       |
| 暗号      | v1暗号プロファイルの構造、鍵導出、認証付き暗号        | 秘密情報の保存、鍵管理、利用者への警告             |
| 要求/応答 | `requestId`、要求・応答のデータ構造                   | 期限の現在時刻比較、replay防止、状態遷移、承認判断 |
| 接続      | 接続要求・応答のwire表現                              | セッション、認可、失効、送信者認証                 |
| 搬送      | 完全なSNIFバイト列および規範的text representation     | QR、通信、再送、通信路認証、分割・再構成           |

SNIF codecは、外部ストレージ、Cookie、データベース、セッション状態、permission state、監査状態、ノードへアクセスしてはならない。

## 2. 用語と設計原則

| 用語             | 定義                                                                                |
| ---------------- | ----------------------------------------------------------------------------------- |
| envelope         | SNIFの外側CBOR map。protocol、version、type、chain、network、options、payloadを持つ |
| payload          | type固有の内側CBOR mapを表すbyte string                                             |
| options          | integrityおよびencryptionのプロファイルを表すmap                                    |
| codec            | SNIF byte列と検証済みdocumentを変換する、外部状態を変更しない処理                   |
| requestId        | 要求と応答を対応付ける、意味を持たない不透明な識別子                                |
| display metadata | `name`、`origin`、`iconUrl`などの自己申告表示情報                                   |

次の原則を適用する。

- 公開情報交換、接続状態、permission grantを別の意味として扱う。`contact`を接続承認の代替にしてはならない。
- `origin`、`iconUrl`、アプリケーション名は自己申告の表示情報であり、認証、本人性、ドメイン所有、信頼の根拠にしてはならない。
- `chain`と`network`は共通envelopeで一度だけ表現する。payloadへ複製してはならない。
- 未知のversion、type、必須機能、暗号方式、permission、フィールドを推測して受理してはならない。
- 形式検証とチェーン・業務上の意味検証を分離する。
- 同じ論理入力は、実装言語と搬送手段に依存しない同じbyte列を生成しなければならない。

## 3. 共通データモデル

### 3.1 envelope

envelopeは次の7フィールドを必須とする。追加フィールドはv1で禁止する。

```cddl
snif-envelope = {
  "protocol": "snif",
  "version": 1,
  "type": format-type,
  "chain": chain,
  "network": network,
  "options": options,
  "payload": bstr,
}

chain = "symbol" / "nem" / "none"

format-type =
    "address"
  / "contact"
  / "account"
  / "mnemonic"
  / "transaction-request"
  / "connection-request"
  / "connection-response"
  / "signing-request"
  / "signing-response"
  / "object"
```

`chain: "none"` はチェーン非依存の `object` だけに許可する。`address`、`contact`、`account`、`mnemonic`、transaction、connection、signingの各typeは `symbol` または `nem` を要求する。

### 3.2 network

```cddl
network = symbol-network / nem-network / none-network

symbol-network = {
  "id": uint .le 255,
  "generationHashSeed": bstr .size 32,
}

nem-network = {
  "id": int .ge -128 .le 127,
}

none-network = {
  "id": 0,
}
```

Symbolでは `id` と `generationHashSeed` の組をnetwork識別子とする。NEMでは `id` を符号付き8-bit整数として扱い、既知のmain network `104`、test network `-104`、および対象環境が明示的にサポートするprivate network値を区別する。network IDだけを別チェーンのnetwork IDとして解釈してはならない。

NEMのSNIF `network.id` はCBORの論理整数であり、許容範囲は `-128..127` である。実装はこの範囲の整数だけを受理しなければならない。NEMアドレスの先頭network byteは符号なしoctetなので、SNIFの論理値からraw byteへ変換する場合は `id < 0 ? id + 256 : id`、raw byteから論理値へ戻す場合は最上位bitが1なら `byte - 256` とする。したがってmain networkは論理値 `104` / raw byte `0x68`、test networkは論理値 `-104` / raw byte `0x98` となる。raw byte値 `152` をSNIFの `network.id` として受理してはならない。private networkでは構造上この符号付き範囲を許可するが、サポート可否はhostまたはチェーン固有検証層が決定する。

codecはnetworkオブジェクトの型、範囲、chainとの組合せを検証する。Symbolのgeneration hash、NEMのnetwork値のオンチェーン上の意味、およびアドレスとの整合性はhostまたは対象チェーンの検証層で確認する。

### 3.3 options

```cddl
options = {
  "integrity": integrity-option,
  "encryption": encryption-option,
}

integrity-option =
    { "algorithm": "sha3-256", "digest": bstr .size 32 }
  / { "algorithm": "aead" }

encryption-option =
    { "algorithm": "none" }
  / { "algorithm": "password-v1", "salt": bstr .size 16, "nonce": bstr .size 12 }
```

平文payloadでは `integrity.algorithm` を `sha3-256`、`encryption.algorithm` を `none` とする。digestは、処理前のpayload byte stringに対するFIPS 202 SHA3-256である。暗号化payloadでは `integrity.algorithm` を `aead` とし、AEAD認証タグを完全性検証に使用する。平文payloadに `aead`、暗号化payloadに `sha3-256` を指定してはならない。

### 3.4 共通値の制約

個別typeに別の規定がない限り、次を適用する。

| 値           | 制約                                                      |
| ------------ | --------------------------------------------------------- |
| byte string  | CBOR byte string。hexおよびBase64文字列をwireに使用しない |
| 通常の文字列 | 正しいUTF-8、Unicode NFC、空文字列禁止                    |
| byte長       | 表記した長さは厳密なbyte長                                |
| 時刻         | UTC Unix秒の非負整数                                      |
| 表示文字列   | U+0000〜U+001FおよびU+007Fを禁止                          |
| URI          | RFC 3986 absolute-URI。相対URIを受理しない                |

受信側はNFCを暗黙に適用してはならない。正規化形式を満たさない入力を拒否する。診断用JSONでのbyte stringは `hex:` 接頭辞付き大文字16進数で表してよいが、これはwire表現ではない。

## 4. 決定的エンコードとwire規則

### 4.1 CBORプロファイル

envelopeとpayloadの両方にRFC 8949 section 4.2.1の決定的エンコードを使用する。

- 整数は最短表現を使用する。
- map keyは決定的順序に並べる。
- map、array、文字列は確定長表現を使用する。
- map keyの重複を禁止する。
- CBOR tag、浮動小数点、`null`、`undefined`、不定長表現を禁止する。
- 最上位CBOR itemの後ろにbyteが残る入力を拒否する。
- decode後に再エンコードしたbyte列が入力とbyte-for-byteで一致しなければ拒否する。

v1のmap keyは大文字・小文字を区別するUTF-8文字列である。診断用JSONのプロパティ順、TypeScript objectの挿入順、ライブラリ固有のmap順序をwire規則としてはならない。

### 4.2 encode

送信側は次の順序で処理する。

```text
document validation
  -> deterministic CBOR(payload)
  -> SHA3-256 integrity or password-v1 AEAD
  -> deterministic CBOR(envelope)
```

暗号化時は `options` を含む、`payload`を除いたenvelope headerを決定的CBORでエンコードし、そのbyte列をAADとする。`payload`には `ciphertext || authentication-tag` を格納する。

encode：非canonicalなdocument入力をinvalid-contextで拒否
decode：非canonicalなwire payloadをinvalid-contextで拒否
呼び出し側：canonical順序で配列を組み立てる
補助関数を提供する場合：明示的なcanonicalizePermissions()として別APIにする

### 4.3 decode

受信側は次の順序で処理する。

1. 入力byte長を確認する。
2. 外側CBORの構文、決定性、重複key、resource limitを確認する。
3. protocol、version、type、chain、network、optionsの整合性を確認する。
4. 暗号化profileの形とpayload長を確認する。
5. 暗号化されている場合は認証・復号を完了する。認証前の平文を返してはならない。
6. 平文payloadの場合はSHA3-256 digestを検証する。
7. 内側CBORの構文、決定性、型固有schema、resource limitを確認する。
8. chainとpayloadのbyte長、列挙値、文字列正規化、requestIdとpermissionの整合性を確認する。

### 4.4 inspect

`inspect` は外側envelopeだけを検証し、payloadの復号、digest検証、payload decodeを行わず、次のheader情報だけを返す。

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

`inspect` の成功はpayloadの妥当性を示さない。

### 4.5 規範的text representation

v1のtext representationは、完全なSNIF binary byte列をRFC 4648 section 5のBase64URLで表現したASCII文字列である。形式は次のとおりとする。

```text
snif1:<unpadded-base64url-of-complete-snif-bytes>
```

`snif1:` は小文字固定のprefixであり、prefixの後ろは空であってはならない。Base64URLには `A-Z`、`a-z`、`0-9`、`-`、`_` だけを使用し、`=` padding、標準Base64の `+` / `/`、空白、改行、その他の文字を使用してはならない。入力はASCIIでなければならず、decode後のbyte列を再度canonicalにencodeした結果が入力全体と一致しない場合は拒否する。text representationはJSON、hex、payload単体、または搬送層の分割データではない。

`encodeText` は `encode` と同じdocument validation、暗号化、決定的CBOR処理を行った完全なSNIF byte列をBase64URL化して返す。`decodeText` はprefix、ASCII、canonical Base64URL、decoded byte長を検証した後、同じ入力を `decode` へ渡す。decoded byte列が16 MiBを超える場合はCBOR decode前に `resource-limit` として拒否する。text固有の構文または正規性違反は `invalid-text` とする。`encodeText` の出力は常に一意なcanonical textであり、実装は別のBase64表記を生成してはならない。

## 5. 標準payload

### 5.1 address

```cddl
address-payload = {
  "address": chain-address,
}
```

Symbol addressは24 bytes、NEM addressは25 bytesとする。codecは長さとchainとの対応だけを検証し、checksum、network byte、Base32表現、およびオンチェーン上の存在を検証しない。

### 5.2 contact

```cddl
contact-payload = {
  "name": text .size (1..128),
  "address": chain-address,
  ? "publicKey": bstr .size 32,
}
```

`contact` は公開情報交換だけを表す。接続、permission grant、所有証明、本人性証明を表さない。`publicKey`が存在する場合、walletまたはhostはenvelopeのchain/networkに従ってaddressとの整合性を別途検証する。

### 5.3 account

```cddl
account-payload = {
  "privateKey": bstr .size 32,
  "publicKey": bstr .size 32,
  "address": chain-address,
}
```

`account` は、password未指定なら平文、password指定なら `password-v1` で暗号化する。実装は平文accountのencodeおよびdecodeを許可しなければならない。平文は秘密性、保存安全性、搬送安全性を持つものとして扱ってはならない。復号後または平文decode後のhostは秘密鍵から公開鍵を、公開鍵とnetworkからaddressを導出して整合性を検証し、不一致時は秘密情報を利用者へ返してはならない。codecはこの導出を行わない。

### 5.4 mnemonic

```cddl
mnemonic-payload = {
  "scheme": "bip39",
  "language": bip39-language,
  "mnemonic": text .size (1..1024),
  ? "passphrase": text .size (0..1024),
}

bip39-language =
    "english" / "japanese" / "korean" / "spanish"
  / "chinese-simplified" / "chinese-traditional"
  / "french" / "italian" / "czech" / "portuguese"
```

`mnemonic` と `passphrase` はUnicode NFKD、単語間はASCII space 1文字とする。暗号化用passwordとBIP39 passphraseを同一視してはならない。codecは単語list、checksum、seed、chain別鍵導出を検証しない。`mnemonic` は、password未指定なら平文、password指定なら `password-v1` で暗号化する。実装は平文mnemonicのencodeおよびdecodeを許可しなければならない。平文の秘密性、保存安全性、搬送安全性は保証しない。

### 5.5 transaction-request

```cddl
transaction-request-payload = {
  "requestId": request-id,
  "transactionPayload": bstr .size (1..8388608),
}
```

`transactionPayload` は対象chainの完全なシリアライズ済みtransaction byte列を不透明に格納する。codecはtransaction type、fee、deadline、recipient、mosaic、message、signature、hash、署名可能性、またはオンチェーン有効性を検証しない。

### 5.6 connection-request

```cddl
connection-request-payload = {
  "application": application-metadata,
  "permissions": [1*3 connection-permission],
  "requestId": request-id,
}

application-metadata = {
  "name": text .size (1..128),
  "origin": text .size (1..2048),
  ? "iconUrl": text .size (1..2048),
}

connection-permission =
    "account" / "sign-transaction" / "sign-message"

connection-signing-permission = "sign-transaction" / "sign-message"
```

`permissions` は重複禁止で、未知のpermissionを含む要求全体を拒否する。配列は `account`、`sign-transaction`、`sign-message` の定義順に並べる。`requestId` は16 bytesの不透明値で、全zeroを禁止する。生成側は暗号学的に安全な乱数を使用し、再利用を避ける。

`origin` はabsolute URI、`iconUrl` は指定する場合absolute URIとする。これらは自己申告表示情報であり、認証根拠ではない。SNIF codecはiconUrlを取得してはならない。

### 権限配列のcanonical順序

connectionのpermissionには、次のcanonical順序を適用する。

1. `account`
2. `sign-transaction`
3. `sign-message`

`connection-request`および`connection-response`の`permissions`は、含まれるpermissionをこの定義順に並べなければならない。

permissionの省略によって残りの要素が前へ詰められることは許可するが、残った要素の相対順序を変更してはならない。

codecは、未知のpermission、重複したpermission、またはcanonical順序に従わないpermissions配列を`invalid-context`として拒否しなければならない。codecは入力配列を暗黙に並べ替えて受理してはならない。

### 5.7 connection-response

```cddl
connection-response-payload = connection-approved / connection-denied

connection-approved = connection-approved-with-account / connection-approved-without-account

connection-approved-with-account = {
  "approved": true,
  "requestId": request-id,
  "account": account-reference,
  "permissions": ["account", *2 connection-signing-permission],
}

connection-approved-without-account = {
  "approved": true,
  "requestId": request-id,
  "permissions": [1*2 connection-signing-permission],
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

承認responseの`permissions`は、対応する要求の`permissions`の部分集合でなければならない。要求にないpermission、未知のpermission、重複したpermissionを承認してはならない。

承認responseの`permissions`は、`account`、`sign-transaction`、`sign-message`のcanonical順序に従わなければならない。canonical順序に従わないresponseは、同じpermission集合を表している場合でも`invalid-context`として拒否しなければならない。

`account` permissionを許可する場合は、`permissions`の先頭を`account`とし、`account`フィールドを必須とする。`account` permissionを許可しない場合は、`permissions`およびpayloadの`account`フィールドへ`account`を含めてはならない。

### 5.8 signing-request

```cddl
signing-request-payload = {
  "requestId": request-id,
  "signingType": "transaction" / "message",
  "payload": bstr .size (0..8388608),
  ? "purpose": text .size (1..256),
  ? "expectedSignerPublicKey": bstr .size 32,
}
```

`signingType: "transaction"` のpayloadは1〜8 MiB、`signingType: "message"` のpayloadは0〜1 MiBとする。messageでは `purpose` を必須とする。codecは署名対象の意味、表示内容との一致、署名者、domain separation、期限、replay、元requestとの業務上の対応を検証しない。

### 5.9 signing-response

```cddl
signing-response-payload = signing-approved / signing-denied

signing-approved = {
  "approved": true,
  "requestId": request-id,
  "signature": bstr .size 64,
  "signerPublicKey": bstr .size 32,
}

signing-denied = {
  "approved": false,
  "requestId": request-id,
}
```

拒否responseはrequestId以外の署名材料を含めてはならない。codecはsignature検証、signerPublicKeyの所有、署名対象との対応を検証しない。

### 5.10 object

```cddl
object-payload = {
  "value": object-value,
}

object-value =
    bool / int / text / bstr
  / [* object-value]
  / { * text => object-value }
```

`object` はチェーン非依存の限定された構造化データである。float、tag、null、undefined、非文字列map key、外部パッケージによるtype登録を許可しない。意味、schema、信頼性は利用側が定義する。

### 5.11 共通payload定義

```cddl
chain-address = symbol-address / nem-address
symbol-address = bstr .size 24
nem-address = bstr .size 25
request-id = bstr .size 16
```

`requestId` の生成、衝突回避、再利用防止、応答との対応、および必要な期限policyはhostの責務である。v1のwireには期限fieldを定義しない。SNIFは `requestId` を消費・保存・失効させない。

### 5.12 診断用JSON例

次の例はCBOR wireではなく、byte stringを `hex:` 表記した診断用の論理JSONである。wireではpayload全体を決定的CBORのbyte stringへ変換する。

`digest` の全zero値は構造を示すための例示値であり、実際のpayloadに対する有効なdigestではない。

```json
{
  "protocol": "snif",
  "version": 1,
  "type": "connection-request",
  "chain": "symbol",
  "network": {
    "id": 152,
    "generationHashSeed": "hex:57F7DA205008026C776CB6AED843393F04CD458E7D55817A54BEBDD4058A7D54"
  },
  "options": {
    "integrity": {
      "algorithm": "sha3-256",
      "digest": "hex:0000000000000000000000000000000000000000000000000000000000000000"
    },
    "encryption": {
      "algorithm": "none"
    }
  },
  "payload": {
    "application": {
      "name": "Example dApp",
      "origin": "https://example.com",
      "iconUrl": "https://example.com/icon.png"
    },
    "permissions": ["account", "sign-message"],
    "requestId": "hex:00112233445566778899AABBCCDDEEFF"
  }
}
```

拒否responseの論理JSONは次のとおりである。拒否時にaccount、publicKey、permissionsを含めてはならない。

```json
{
  "approved": false,
  "requestId": "hex:00112233445566778899AABBCCDDEEFF"
}
```

## 6. 暗号化プロファイル

### 6.1 password-v1

`password-v1` はv1唯一の暗号化profileである。すべてのpayloadでpassword指定時に使用でき、accountとmnemonicでも任意である。password未指定時は `encryption.algorithm: "none"` の平文payloadを使用する。公開鍵暗号、鍵合意、接続応答の暗号化はv1対象外とする。

passwordは入力どおりUTF-8へ変換し、trim、大文字小文字変換、Unicode正規化を行わない。passwordの最大長はUTF-8で1,024 bytesとする。空passwordは拒否する。

### 6.2 KDF

Argon2id RFC 9106を次の固定値で使用して32-byte鍵を導出する。

| パラメーター             |                       値 |
| ------------------------ | -----------------------: |
| memory                   |               65,536 KiB |
| iterations               |                        3 |
| parallelism              |                        4 |
| output length            |                 32 bytes |
| version                  |                   `0x13` |
| secret / associated data |                    empty |
| salt                     | CSPRNGで生成した16 bytes |

KDFパラメーターを攻撃者制御のenvelope fieldにしてはならない。将来変更する場合は新しいencryption profileを定義する。

### 6.3 AES-GCM

導出鍵でAES-256-GCMを使用する。nonceは毎回CSPRNGで生成した12 bytes、authentication tagは16 bytesとする。AADは `payload` を除くenvelope全体の決定的CBORである。payloadは次のbyte列とする。

```text
ciphertext || authentication-tag
```

通常APIはsaltまたはnonceを呼び出し側から受け取ってはならない。固定salt、nonce、導出鍵の注入は適合fixture専用に限定する。

### 6.4 復号失敗

暗号化payloadに対するpassword未指定は `password-required`、password不一致、ciphertext破損、AAD不一致、tag不一致はすべて `decryption-failed` とする。平文accountまたはmnemonicに対してpasswordがないことはエラーではない。詳細な失敗理由を外部へ返してはならない。

認証が完了する前に復号済みpayloadをdecode、展開、表示、ログ出力してはならない。秘密情報を含むbufferは不要になった時点でbest effortによりzeroizeする。ただしGC、JIT、swap、core dump内の完全消去は保証しない。

## 7. 実行環境とprovider境界

### 7.1 対応環境

v1の参照実装は次を対象とする。

- Node.js 20以上。
- Web Crypto、AbortSignal、BigIntを提供する現行ブラウザおよびmodule Worker。
- React NativeおよびExpo。ただし、対象アプリが暗号学的乱数、Argon2id、AES-256-GCM、必要なbyte APIを提供するproviderを初期化していること。

SNIF coreはNode.js built-in、filesystem、DOM、window、localStorage、native moduleを直接参照してはならない。公開形式はruntime-neutralなESM APIとし、各環境のbundle/provider差をwire形式へ混入させない。

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

providerは、指定長以外の乱数を返した場合、暗号認証に失敗した場合、または処理が中断された場合に定義済みerrorへ変換される。非暗号学的乱数、時刻、固定値へのfallbackを禁止する。

実装はruntimeごとにKDF同時実行数、memory確保量、AbortSignal処理を制限できる。ただし、仕様上のwire値、KDF値、error categoryを変更してはならない。

## 8. 公開API

```ts
type Chain = 'symbol' | 'nem' | 'none';
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
type SymbolNetwork = { id: number; generationHashSeed: Uint8Array };
type NemNetworkId = number; // runtime validation: integer in -128..127
type NemNetwork = { id: NemNetworkId };
type NoneNetwork = { id: 0 };
type Network = SymbolNetwork | NemNetwork | NoneNetwork;
type Options = {
  integrity: { algorithm: 'sha3-256'; digest: Uint8Array } | { algorithm: 'aead' };
  encryption: { algorithm: 'none' } | { algorithm: 'password-v1'; salt: Uint8Array; nonce: Uint8Array };
};

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
    type: T;
    chain: Chain;
    network: Network;
    payload: PayloadByType[T];
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

interface SnifCodec {
  encode(document: SnifDocument, options?: EncodeOptions): Promise<Uint8Array>;
  decode(data: Uint8Array, options?: DecodeOptions): Promise<SnifDocument>;
  encodeText(document: SnifDocument, options?: EncodeOptions): Promise<string>;
  decodeText(text: string, options?: DecodeOptions): Promise<SnifDocument>;
  inspect(data: Uint8Array): SnifHeader;
}

declare function createSnifCodec(options: { cryptoProvider: SnifCryptoProvider }): SnifCodec;
```

`createSnifCodec` はproviderを保持するcodec instanceを返す。`encode`、`decode`、`inspect`は外部状態を変更してはならない。入力のUint8Arrayを無断で変更してはならない。秘密payloadをdecodeした場合、その後の消去責任は呼び出し側へ移る。

`encode` と `encodeText` は、`password` がない場合に `encryption.algorithm: "none"`、`password` がある場合に `password-v1` を選択する。accountおよびmnemonicでもpasswordは任意であり、password未指定の平文を許可する。`decode` と `decodeText` は、暗号化payloadに限りpasswordを要求する。呼び出し側はsalt、nonce、KDF parameter、AADを指定できない。`encodeText` と `decodeText` のtext規則はsection 4.5に従う。

公開型はwire schemaを表すが、型だけでbyte長、正規化、chain/network整合性、暗号認証を保証してはならない。runtime validationを必須とする。

## 9. エラー仕様

公式実装はparser固有メッセージと別に、次の機械判定可能なcodeを公開する。

| code                                                                                                                 | 発生条件                                                                               |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `invalid-envelope`                                                                                                   | 外側CBOR、必須field、重複key、決定性、options、chain/networkが不正                     |
| `unsupported-version`                                                                                                | protocolはsnifだがversionが未対応                                                      |
| `unsupported-type`                                                                                                   | versionは対応するがtypeを実装していない                                                |
| `unsupported-codec`                                                                                                  | 構文は正しいが暗号profileまたはproviderが未対応                                        |
| `password-required`                                                                                                  | 暗号化payloadにpasswordがない                                                          |
| `decryption-failed`                                                                                                  | password、AAD、ciphertext、認証tagの失敗                                               |
| `invalid-text`                                                                                                       | `snif1:` prefix、ASCII、Base64URL、canonical性の検証失敗                               |
| `invalid-payload`                                                                                                    | 内側CBOR、type schema、正規化、型、列挙値が不正                                        |
| `invalid-context`                                                                                                    | requestId、permissions、要求・応答条件の構造が不正                                     |
| `resource-limit`                                                                                                     | byte、文字列、map、array、nest、KDF resourceの上限超過                                 |
| `operation-cancelled`                                                                                                | AbortSignalまたは利用者要求による中断                                                  |
| `entropy-unavailable`                                                                                                | CSPRNGが利用不能、失敗、指定長未満を返した                                             |
| `provider-unavailable`                                                                                               | 対象runtimeの必須providerが初期化されていない                                          |
| `invalid-context`                                                                                                    | requestId、permissionの重複・未知値・非canonical順序、または要求・応答の構造条件が不正 |
| エラーのmessage、cause、ログ、telemetryにpassword、privateKey、mnemonic、復号済みpayload、導出鍵を含めてはならない。 |

## 10. サイズと資源制限

| 対象                |                                                 最大値 |
| ------------------- | -----------------------------------------------------: |
| 完全なSNIF byte列   |                                                 16 MiB |
| envelope.payload    |                                                 16 MiB |
| 展開処理            | v1では圧縮を禁止。providerが圧縮を受け付けてはならない |
| CBOR nest depth     |                                                     16 |
| 1 mapの要素数       |                                                     64 |
| 1 arrayの要素数     |                                                    256 |
| 一般文字列          |                                     UTF-8で1,024 bytes |
| name                |                                       UTF-8で128 bytes |
| origin / iconUrl    |                                     UTF-8で2,048 bytes |
| purpose             |                                       UTF-8で256 bytes |
| message payload     |                                                  1 MiB |
| transaction payload |                                                  8 MiB |
| password            |                                     UTF-8で1,024 bytes |
| Argon2id同時実行    |           実行中1件、待機1件までを参照実装の上限とする |

上限は、攻撃者制御の値を使った大規模なメモリ確保、KDF、CBOR decodeの前に適用する。搬送層はこれより小さい上限を適用してよい。

## 11. セキュリティ要件

- privateKey、mnemonic、password、導出鍵、復号済みpayloadをログ、例外、診断出力、clipboard、永続storageへ出力してはならない。
- 外部metadataを認証根拠として扱ってはならない。
- 平文完全性digestを送信者認証と誤認させてはならない。
- accountおよびmnemonicの平文を受理してよいが、平文を安全な保存・搬送または暗号化済みデータとして扱ってはならない。利用側は秘密情報の保護と利用者への警告を別途担う。
- unknown permission、要求外permission、重複permissionを承認してはならない。
- 拒否responseにaccount、公開鍵、permission、session情報を含めてはならない。
- chain/networkが一致しないaddress、account、transaction、connection、signing payloadを受理してはならない。
- 未知version、未知type、未知field、未知暗号方式へ暗黙のfallbackをしてはならない。
- KDF、CBOR decode、暗号処理のresource limitを回避してはならない。
- requestIdや期限を、SNIF codecだけでreplay防止済みと扱ってはならない。

## 12. バージョンと互換性

v1の `version` は整数 `1` だけを定義する。v1 decoderは未知field、未知type、未知option、未知permissionを拒否する。未知versionは `unsupported-version` とする。

フィールドの意味、署名対象、暗号処理、正規化、許容値、network判定を変更する場合は、新しいwire versionまたは名前付きprofileを定義する。既存v1の意味を実装者判断で変更してはならない。

搬送profileは完全なSNIF byte列を不透明に扱い、SNIF v1から独立して進化できる。

## 13. 適合fixture要件

fixtureの正本は、将来追加する `doc/fixtures/manifest.json` とmanifestから参照されるfixture本体とする。仕様本文、実装内test constant、診断用JSONから期待byte列を再生成してはならない。

最低限、次のfixtureカテゴリを用意する。

| category                 | 必須内容                                                                  |
| ------------------------ | ------------------------------------------------------------------------- |
| `cbor-envelope`          | 正常envelope、決定性、chain/network分岐、末尾byte、重複key                |
| `codec-component-matrix` | 10 typeの正常、境界、不正case、期待payloadと期待error                     |
| `password-v1`            | 固定password、salt、nonce、AAD、導出鍵、ciphertext、tag、誤password、改変 |
| `secret-backup`          | account/mnemonicの平文成功、暗号化成功、誤password、改変、password欠落    |
| `connection`             | contact分離、未知/重複/要求外permission、部分subset、拒否時最小開示       |
| `request-response`       | wire上のrequestId対応、transaction/signing request/response               |
| `text-representation`    | `snif1:` 正常、binaryとの往復、canonical性、不正文字、padding、サイズ超過 |
| `host-context`           | wire外の期限、現在時刻、replay状態、requestId対応に対するhost判定         |
| `resource-limit`         | byte、文字列、map、array、nest、KDF同時実行の上限                         |
| `unicode`                | NFC/NFKD、ASCII space、passwordの未正規化                                 |

正常caseは期待payload CBORとenvelope CBORを大文字16進で持ち、適合実装はbyte-for-byteで一致しなければならない。不正caseは指定されたerror codeで失敗しなければならない。暗号fixture以外の秘密情報は実運用値を使用してはならない。

`wire` fixtureは完全なSNIF byte列を入力とし、codecの出力またはerrorを検証する。`host-context` fixtureはSNIF byte列ではなく、次の外部JSONを持つ。

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

`requestFixture` と `responseFixture` はwire fixtureへの参照、`now` と `requestValidUntil` はhostが管理するUTC Unix秒、`replayState` は `unseen` または `seen`、`expected` は `accept` または `reject` とする。requestIdが一致し、`replayState` が `unseen` で、`now < requestValidUntil` の場合だけ `accept` を期待する。それ以外は `reject` とする。期限値はhost-contextにのみ存在し、SNIF envelopeまたはpayloadへ追加してはならない。host-contextの検証主体はwalletまたはhostであり、SNIF codecは現在時刻、期限、replay store、接続状態を参照してはならない。

必要なfixture

最低限、次を追加します。

正常系
ケース	permissions
accountのみ	["account"]
account＋transaction	["account", "sign-transaction"]
account＋message	["account", "sign-message"]
全権限	["account", "sign-transaction", "sign-message"]
transactionのみ	["sign-transaction"]
messageのみ	["sign-message"]
署名権限両方	["sign-transaction", "sign-message"]
拒否系
ケース	permissions	期待結果
署名権限の逆順	["sign-message", "sign-transaction"]	invalid-context
accountありの逆順	["account", "sign-message", "sign-transaction"]	invalid-context
accountが後方	["sign-transaction", "account"]	invalid-context
重複	["sign-message", "sign-message"]	invalid-context
未知権限	["sign-message", "unknown"]	invalid-context
account field不一致	permissionsにaccountなし、payloadにaccountあり	invalid-context
account欠落	permissionsにaccountあり、payloadにaccountなし	invalid-context

さらに、正常系fixtureは期待payload CBORと期待envelope CBORを固定し、逆順fixtureは同じ論理集合であっても拒否されることを確認します。現仕様は、正常caseではbyte-for-byte一致、不正caseでは指定error codeで失敗することを要求しています。

## 14. 要件・レビューとの追跡

| 対象                   | 本仕様での対応                                                     |
| ---------------------- | ------------------------------------------------------------------ |
| FR-001〜FR-006         | sections 3, 4, 9, 10, 12                                           |
| FR-007〜FR-012         | sections 3, 4, 6, 10                                               |
| FR-009, AC-007         | sections 5.3, 5.4, 6.1, 8, 9, 11, 13                               |
| FR-011, AC-001, AC-018 | sections 4.5, 8, 9, 13                                             |
| FR-013〜FR-017         | sections 2, 5.2, 5.6, 5.7, 11                                      |
| FR-018〜FR-020         | sections 5.5, 5.8, 5.9, 12                                         |
| FR-019, AC-010〜AC-013 | sections 5.7, 5.11, 13                                             |
| SEC-001〜SEC-008       | sections 6, 7, 9, 10, 11                                           |
| NFR-001〜NFR-008       | sections 4, 7, 8, 13                                               |
| AC-001〜AC-018         | sections 13および各typeのschema/検証規則                           |
| RR-001                 | 具体的error、permission、開示、resource limit、fixture期待値を定義 |
| RR-002                 | Node.js、browser、React Native、Expoと共通provider境界を定義       |
| RR-003                 | 参照資料をrepository-relative pathで記載                           |
| SR-001                 | account/mnemonicの平文と暗号化をpassword有無で一意に定義           |
| SR-002                 | `snif1:` + unpadded Base64URLの規範的text representationを定義     |
| SR-003                 | NEM `network.id` を論理signed int8としてCDDL、型、変換、境界を統一 |
| SR-004                 | wire fixtureと期限を扱うhost-context fixtureを分離                 |

### 14.1 未決定事項の処理

| 要件ID   | v1での扱い                                                                       |
| -------- | -------------------------------------------------------------------------------- |
| OPEN-001 | 決定的CBORとenvelope/payload schemaを本仕様で固定                                |
| OPEN-002 | `snif1:` + unpadded Base64URLの規範的text representationをv1で採用               |
| OPEN-003 | password-v1、Argon2id、AES-256-GCM、固定パラメーターを採用                       |
| OPEN-004 | 接続時の鍵合意・応答暗号化はv1対象外                                             |
| OPEN-005 | callback/Relayの通信構造はv1対象外                                               |
| OPEN-006 | 既知permission、不透明16-byte requestIdを採用し、期限・replay policyはhostへ委譲 |
| OPEN-007 | NEM transactionは不透明byte stringとして扱う                                     |
| OPEN-008 | custom type登録はv1対象外                                                        |
| OPEN-009 | section 10の共通上限とprovider同時実行上限を採用                                 |
| OPEN-010 | Node.js、browser、React Native、Expoを対象とし、provider境界で環境差を隔離       |

## 15. 参照資料と作成状況

| 種別                    | 参照先                                                                                | 用途                                                   |
| ----------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| コンセプト              | `packages/symbol-nem-interchange-format/doc/concept-sheet.md`                         | 目的、v1境界、責任分担、判断原則                       |
| コンセプトレビュー      | `packages/symbol-nem-interchange-format/doc/reviews/concept-sheet-review-findings.md` | 対象一致、Required Changesなし、次段階進行判定         |
| 要件                    | `packages/symbol-nem-interchange-format/doc/requirements.md`                          | 機能要件、非機能要件、受け入れ条件、OPEN項目           |
| 要件レビュー            | `packages/symbol-nem-interchange-format/doc/reviews/requirements-review-findings.md`  | RR-001、RR-002、RR-003の対応                           |
| Symbol知識資料          | `docs/knowledge/symbol-openapi3.yml:538-548`                                          | transactionの意味・serializationをSNIF外へ委譲する境界 |
| NEM Technical Reference | `docs/knowledge/nem-technicalref.pdf` pp.3-4                                          | NEM addressのnetwork byte `0x68` / `0x98`              |
| NEM知識資料             | `docs/knowledge/nem-openapi3.yaml:164-170`                                            | 論理network ID `104` / `-104`の表現                    |
| NEM SDK資料             | `packages/symbol-sdk/src/nem/Network.js:112-113`                                      | SDKのraw byte表現とSNIF論理値の区分                    |
| 仕様レビュー            | `packages/symbol-nem-interchange-format/doc/reviews/spec-review-findings.md`          | SR-001〜SR-004の指摘と対応状況                         |

コンセプトレビューは「要件定義へ進める」、要件レビューは「仕様設計へ進める」と判定されている。要件レビューのRR-001およびRR-002は本仕様で具体化した。RR-003は参照先をrepository-relative pathへ統一した。

現行 `spec.md` に対する仕様レビュー結果は2026-08-06確認時点で存在し、対象一致と判定「仕様の修正を優先する」を確認した。SR-001〜SR-004を本文、API、error、fixture、追跡表へ反映し、すべて対応済みとする。実装者改善依頼ファイル `.reviews/blockchain-implementation-spec-feedback.md` は存在せず、対象外である。
