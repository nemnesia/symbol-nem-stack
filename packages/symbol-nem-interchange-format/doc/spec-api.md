# Symbol/NEM Interchange Format（SNIF）v1 API仕様書

## 1. 目的

本書は、SNIF v1のJSONフォーマットをアプリケーションから生成、解析、検証し、`account` / `mnemonic` の機密payloadを保護・復元するためのライブラリAPIを定義する。

APIはフォーマット設計書をそのまま扱う薄い境界とし、API上の利便性を理由としてwire formatの標準タイプ、フィールドまたは意味を追加しない。

SNIF APIは次を行わない。

- QR、Animated QR、Deep Link、Clipboard、NFC、Relay、HTTP、WebSocket等の搬送処理
- UI、利用者承認、認証・認可
- 接続セッション、要求の使用済み状態、リプレイ・重複実行の状態管理
- アドレス、公開鍵、トランザクション等のチェーン上の意味検証
- トランザクションの作成、署名、連署、アナウンス
- 秘密鍵、ニーモニック、パスワード等の永続保存
- 送信者、dApp、URL、ドメイン、アイコン等の真正性・信頼性の判定

## 2. 参照文書

- SNIF要件定義
- SNIFフォーマット設計書

本書で定義するAPIは、上記2文書の責任境界を変更しない。フォーマット上未決定の事項を、APIだけで暗黙に補完してはならない。

## 3. API設計原則

### 3.1 最小公開API

v1の中核公開APIは次の5操作とする。

- `parse`: JSON文字列をSNIFデータとして解析・形式検証する。
- `validate`: 既存のJavaScript値をSNIFデータとして形式検証する。
- `serialize`: SNIFデータを形式検証したうえでJSON文字列へ変換する。
- `protect`: 平文の`account` / `mnemonic` payloadを保護する。
- `unprotect`: 保護済みの`account` / `mnemonic` payloadを復元する。

標準タイプごとのbuilder、署名実行API、接続セッションAPI、トランザクション処理APIはv1の公開APIに含めない。

### 3.2 形式検証と意味検証の分離

APIが検証するのはSNIFフォーマットとしての構造・型・表現規則までとする。形式検証成功は、チェーン上の有効性、送信者の真正性、利用者が承認すべき安全性を意味しない。

### 3.3 安全側の拒否

不正構造、未対応version、解釈不能な必須フィールド、不正な型、およびフォーマット上で許可値が明示的に限定されているフィールドの不正値は、推測で補正せず拒否する。

入力サイズ・処理量等の運用上限はSNIFコアの形式検証とは分離し、第17章の責任境界に従う。

### 3.4 非破壊

`validate`、`serialize`、`protect`、`unprotect` は呼び出し元から受け取ったオブジェクトを変更しない。

### 3.5 JSON文字列の同一性を保証しない

SNIF v1はJSON canonicalizationを定義しない。`serialize` が返すJSONのプロパティ順、空白、文字列表現を相互運用上の識別子、ハッシュ入力、署名対象として利用してはならない。

## 4. 公開型

以下はTypeScriptでの論理的な公開型を示す。型名はv1 APIの公開名とする。

```tsx
export const SNIF_VERSION = 1 as const;

export type SnifVersion = 1;
export type HexString = string;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

// TypeScriptのnumber型自体はNaNやInfinityも表現できるため、
// JsonValueとして受理するnumberはruntime validationで有限値に限定する。

export type StandardSnifType =
  | 'address'
  | 'contact'
  | 'account'
  | 'mnemonic'
  | 'transaction'
  | 'connection-request'
  | 'connection-response';

export type StandardTransactionAction =
  | 'display'
  | 'sign'
  | 'sign-response'
  | 'cosign'
  | 'announce'
  | 'sign-and-announce'
  | 'cosign-and-announce';

export type TransactionAction = string;

export type StandardConnectionPermission = 'address' | 'public-key';
export type ConnectionPermission = string;
export type ConnectionStatus = 'approved' | 'rejected';
```

`chain` と `network` はAPI上も文字列とする。標準値は定数として公開するが、型で標準値だけに閉じない。`chain` は `symbol` / `nem` 以外の任意の文字列も受理し、Symbol/NEM以外のチェーンやチェーン非依存データの識別値として利用側アプリケーションが使用できる。

```tsx
export const STANDARD_CHAINS = ['symbol', 'nem'] as const;
export const STANDARD_NETWORKS = ['mainnet', 'testnet'] as const;
export const STANDARD_TYPES = [
  'address',
  'contact',
  'account',
  'mnemonic',
  'transaction',
  'connection-request',
  'connection-response',
] as const;
export const STANDARD_TRANSACTION_ACTIONS = [
  'display',
  'sign',
  'sign-response',
  'cosign',
  'announce',
  'sign-and-announce',
  'cosign-and-announce',
] as const;
export const STANDARD_CONNECTION_PERMISSIONS = [
  'address',
  'public-key',
] as const;
```

## 5. 共通エンベロープ型

```tsx
export interface SnifEnvelopeBase<TType extends string> {
  version: 1;
  type: TType;
  chain: string;
  network: string;
  generationHashSeed?: HexString;
  id?: string;
  replyTo?: string;
}
```

共通フィールドのAPI検証規則は次のとおり。

- `version` は数値 `1` のみ受理する。
- `type` は文字列であることを検証する。標準type以外の扱いは第19章に従う。
- `chain` は文字列であることのみを検証し、`symbol` / `nem` 以外の任意の文字列も受理する。値の意味は利用側アプリケーションが判断する。
- `network` は非空文字列であることを検証する。
- `generationHashSeed`、`id`、`replyTo` は存在する場合のみ検証する。
- `id` / `replyTo` は存在する場合、非空文字列であることを検証する。
- `generationHashSeed` はhex文字列としてのみ検証し、内容、長さ、`chain` / `network` との一致は検証しない。
- `generationHashSeed` はNEMでは使用しないが、SNIF APIは `chain` と `generationHashSeed` の意味上の組み合わせを検証せず、存在のみを理由として拒否しない。必要な判断は利用側アプリケーションが行う。
- `id` / `replyTo` の生成方式、存在確認、期限、使用済み状態、重複状態は検証しない。

## 6. 標準データ型

### 6.1 address

```tsx
export interface AddressPayload {
  address: string;
}

export interface AddressSnif extends SnifEnvelopeBase<'address'> {
  payload: AddressPayload;
}
```

`address` のチェックサム、chain/networkとの対応、実在性は検証しない。

### 6.2 contact

```tsx
export interface ContactPayload {
  name: string;
  address?: string;
  publicKey?: HexString;
  note?: string;
  icon?: string;
}

export interface ContactSnif extends SnifEnvelopeBase<'contact'> {
  payload: ContactPayload;
}
```

`publicKey` はhex表現のみ検証する。`name`、`address`、`publicKey`、`icon` の真正性や相互関係は検証しない。

### 6.3 account

```tsx
export interface AccountPayload {
  privateKey: HexString;
  publicKey: HexString;
  address: string;
}

export interface PlainAccountSnif extends SnifEnvelopeBase<'account'> {
  payload: AccountPayload;
  protectedPayload?: never;
}

export interface ProtectedAccountSnif extends SnifEnvelopeBase<'account'> {
  payload?: never;
  protectedPayload: ProtectedPayload;
}

export type AccountSnif = PlainAccountSnif | ProtectedAccountSnif;
```

秘密鍵から公開鍵・アドレスを導出しない。相互関係も検証しない。

### 6.4 mnemonic

```tsx
export interface MnemonicPayload {
  mnemonic: string;
}

export interface PlainMnemonicSnif extends SnifEnvelopeBase<'mnemonic'> {
  payload: MnemonicPayload;
  protectedPayload?: never;
}

export interface ProtectedMnemonicSnif extends SnifEnvelopeBase<'mnemonic'> {
  payload?: never;
  protectedPayload: ProtectedPayload;
}

export type MnemonicSnif = PlainMnemonicSnif | ProtectedMnemonicSnif;
```

派生パス、言語、追加パスフレーズ、ウォレット復元設定はSNIF payloadとして扱わない。

### 6.5 transaction

```tsx
export interface TransactionPayload {
  action?: TransactionAction;
  payload: HexString;
  result?: TransactionResult;
  signature?: HexString;
}

export type TransactionResult = 'approved' | 'rejected';

export interface TransactionSnif extends SnifEnvelopeBase<'transaction'> {
  payload: TransactionPayload;
}
```

`action` は処理命令ではなく処理意図である。標準値は `STANDARD_TRANSACTION_ACTIONS` で公開するが、未知の文字列値をSNIFコアだけの判断で拒否しない。

`action` が `sign` の場合、共通エンベロープの `id` を必須とし、署名要求として扱う。`action` が `sign-response` の場合、共通エンベロープの `replyTo` と `payload.result` を必須とし、`payload.result` は `approved` または `rejected` とする。`approved` の場合は `payload.signature` を必須とし、hex文字列として検証する。`rejected` の場合は `payload.signature` を指定してはならない。いずれの場合も `payload.payload` は署名対象として扱うtransaction本体のhex文字列とする。

APIはトランザクションの状態、署名可否、連署可否、アナウンス可否を検証せず、処理を実行しない。`replyTo` の参照先の存在、応答の `payload.payload` が要求と一致すること、署名の有効性および署名者の真正性も検証しない。

### 6.6 connection-request

```tsx
export interface ConnectionRequestPayload {
  name?: string;
  url: string;
  permissions: ConnectionPermission[];
  icon?: string;
  note?: string;
}

export interface ConnectionRequestSnif
  extends SnifEnvelopeBase<'connection-request'> {
  payload: ConnectionRequestPayload;
}
```

フォーマット設計書上の必須フィールドは `url` と `permissions` とする。`name`、`icon`、`note` は存在する場合に型を検証する。`permissions` は文字列配列として検証する。標準permissionは `STANDARD_CONNECTION_PERMISSIONS` で公開するが、未知の文字列値をSNIFコアだけの判断で拒否しない。

`name`、`url`、`icon` は自己申告情報として扱う。APIはURL所有者や送信元との一致を検証しない。

### 6.7 connection-response

```tsx
export interface ApprovedConnectionResponsePayload {
  status: 'approved';
  address?: string;
  publicKey?: HexString;
}

export interface RejectedConnectionResponsePayload {
  status: 'rejected';
  address?: never;
  publicKey?: never;
}

export interface ApprovedConnectionResponseSnif
  extends SnifEnvelopeBase<'connection-response'> {
  payload: ApprovedConnectionResponsePayload;
}

export interface RejectedConnectionResponseSnif
  extends SnifEnvelopeBase<'connection-response'> {
  payload: RejectedConnectionResponsePayload;
}

export type ConnectionResponseSnif =
  | ApprovedConnectionResponseSnif
  | RejectedConnectionResponseSnif;
```

APIは `replyTo` が実在する `connection-request` を参照するか、要求されたpermissionと返却情報が一致するかを検証しない。

`status` が `rejected` の場合、`address` / `publicKey` は指定してはならない。

### 6.8 アプリケーション固有type

```tsx
export interface CustomSnif extends SnifEnvelopeBase<string> {
  payload: JsonObject;
  protectedPayload?: never;
}
```

標準7タイプ以外の `type` は、共通エンベロープとJSONとしての `payload` 構造だけを検証する。payload内部の意味・必須項目・相互運用性はSNIF APIで定義しない。

TypeScriptでは `string` から `StandardSnifType` の文字列集合を完全に除外した一般的な文字列型を表現できないため、`CustomSnif` の型定義だけでは標準typeの混入を完全には防止できない。公開TypeScript型は開発時の補助とし、SNIFデータとして有効かどうかの最終判定はruntime validationを正とする。

`parse` / `validate` は `type` が標準7タイプのいずれかに一致する場合、必ず対応する標準typeのpayload規則で検証する。標準typeのpayload規則を満たさないデータを `CustomSnif` としてフォールバック受理してはならない。標準7タイプ以外の文字列の場合にのみアプリケーション固有typeとして扱う。

未知typeを標準typeとして暗黙に処理してはならない。アプリケーションは `isStandardType` で標準typeか明示的に判定してから標準処理へ進む。

```tsx
export type StandardSnifData =
  | AddressSnif
  | ContactSnif
  | AccountSnif
  | MnemonicSnif
  | TransactionSnif
  | ConnectionRequestSnif
  | ConnectionResponseSnif;

export type SnifData = StandardSnifData | CustomSnif;
```

## 7. protectedPayload

`protectedPayload` は `account` / `mnemonic` の元の `payload` JSON全体を暗号化した表現である。その他のtypeでは受理しない。

```tsx
export interface KdfDescriptor {
  name: string;
  salt?: HexString;
  params?: JsonObject;
}

export interface ProtectedPayload {
  cipher: string;
  kdf?: KdfDescriptor;
  nonce?: HexString;
  ciphertext: HexString;
  tag?: HexString;
}
```

`cipher` と `ciphertext` は共通構造として必要とする。`kdf`、`salt`、`params`、`nonce`、`tag` の必須・任意は、選択した暗号プロファイルが必要とする情報に従う。

コアAPIの形式検証は次までを行う。

- 文字列・オブジェクト等のJSON型
- hexとして定義されたフィールドのhex表現
- `payload` / `protectedPayload` の排他
- `protectedPayload` を使用できるtypeの制限
- v1標準暗号プロファイルを識別できる場合の必須フィールド、`kdf.params` の必須integer項目、およびnonce/tagのbyte長

未知の暗号プロファイルについては、コアAPIは共通構造とJSON型・hex表現までを検証し、プロファイル固有の必須性を推測しない。暗号方式固有のパラメータ妥当性、KDFコスト等の実行前検証は、実際に暗号処理を行う `ProtectionProvider` が担う。

SNIF v1 APIは、フォーマット設計書に存在しない暗黙のAADや外側エンベロープとの暗号学的bindingを追加しない。したがって、APIは `protectedPayload` の保護成功を、共通エンベロープ全体の真正性保証として扱わない。

## 8. Result型とエラー

外部入力の不正は通常の想定事象であるため、v1の公開APIは形式エラー・暗号処理エラーを通常の戻り値で返す。想定される入力不正に対して例外を制御フローとして使用しない。

```tsx
export type SnifResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: SnifError };

export interface SnifError {
  code: SnifErrorCode;
  path?: string;
  message: string;
}
```

`path` は問題のあるフィールドを示すJSON Pointer形式とする。エラーには入力値そのもの、秘密鍵、ニーモニック、パスワード、導出鍵、復号済みpayload、provider例外のmessage/causeを含めない。

```tsx
export type SnifErrorCode =
  // JSON解析・JavaScript値
  | 'INVALID_JSON'
  | 'ROOT_NOT_OBJECT'
  | 'INVALID_JSON_VALUE'
  | 'NON_FINITE_NUMBER'
  | 'CIRCULAR_REFERENCE'

  // SNIF形式検証
  | 'UNSUPPORTED_VERSION'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_FIELD_TYPE'
  | 'INVALID_FIELD_VALUE'
  | 'INVALID_HEX'
  | 'PAYLOAD_MISSING'
  | 'PAYLOAD_CONFLICT'
  | 'PROTECTED_PAYLOAD_NOT_ALLOWED'
  | 'INVALID_STANDARD_VALUE'

  // 保護・復元処理
  | 'UNSUPPORTED_PROTECTION'
  | 'INVALID_PROTECTION_PARAMETERS'
  | 'RESOURCE_LIMIT_EXCEEDED'
  | 'PROTECTION_FAILED'
  | 'AUTHENTICATION_FAILED'
  | 'DECRYPTED_PAYLOAD_INVALID';
```

エラーコードは失敗原因の種類を表し、対象フィールドは `path` で表す。フィールド名やtype名ごとの専用エラーコードは原則として追加しない。

| code | 使用条件 |
| --- | --- |
| `INVALID_JSON` | `parse` の入力文字列をJSONとして解析できない。 |
| `ROOT_NOT_OBJECT` | SNIFデータのルート値がJSON objectではない。 |
| `INVALID_JSON_VALUE` | `undefined`、function、symbol、Date、Map、Set、typed array、class instance、sparse array等、SNIF APIが受理するJSON値モデル外の値を含む。 |
| `NON_FINITE_NUMBER` | `NaN`、`Infinity`、`-Infinity` を含む。 |
| `CIRCULAR_REFERENCE` | JavaScript object / Arrayに循環参照が存在する。 |
| `UNSUPPORTED_VERSION` | `version` がAPIの対応versionではない。 |
| `MISSING_REQUIRED_FIELD` | 通常の必須フィールドが存在しない。例: `/network`、`/payload/address`。 |
| `INVALID_FIELD_TYPE` | フィールドは存在するがJSON型が仕様と異なる。例: `network` がnumber、`permissions` がArray以外。 |
| `INVALID_FIELD_VALUE` | 型は正しいが、非空等の一般的な形式制約を満たさない、または条件付きで禁止されたフィールドが存在する。専用コードがある場合はそちらを優先する。 |
| `INVALID_HEX` | hexフィールドが奇数長、`0x` prefix付き、非hex文字を含む等、SNIFのhex表現規則を満たさない。`sign-response` の承認時に指定する `/payload/signature` も含む。 |
| `PAYLOAD_MISSING` | そのtypeで必要な `payload` または `protectedPayload` のいずれも存在しない。 |
| `PAYLOAD_CONFLICT` | 排他的である `payload` と `protectedPayload` が同時に存在する。 |
| `PROTECTED_PAYLOAD_NOT_ALLOWED` | `account` / `mnemonic` 以外のtypeで `protectedPayload` が指定されている。 |
| `INVALID_STANDARD_VALUE` | 仕様で値集合を閉じているフィールドが許可値外である。例: `transaction.payload.result`、`connection-response.payload.status`。未知値を許可する `action` / `permission` には使用しない。 |
| `UNSUPPORTED_PROTECTION` | 指定providerが `cipher` / `kdf` 等の保護プロファイルを扱えない。 |
| `INVALID_PROTECTION_PARAMETERS` | 保護プロファイル固有のパラメータが不正である。例: 標準AES-GCMのnonce/tag長不正、Argon2idパラメータの型・値不正。 |
| `RESOURCE_LIMIT_EXCEEDED` | パラメータ自体は解釈可能だが、KDFコスト等がproviderの安全ポリシー上限を超える。 |
| `PROTECTION_FAILED` | 保護処理またはprovider内部処理が失敗し、他の専用コードに分類できない。 |
| `AUTHENTICATION_FAILED` | 認証付き暗号の検証に失敗した。誤secret、ciphertext破損、tag不一致等を外部から区別しない。 |
| `DECRYPTED_PAYLOAD_INVALID` | 復元されたbyte列はJSONとして解釈できても、元typeのpayload構造として不正である。 |

### 8.1 エラー判定規則

同一入力に複数の不正が存在しても、同じ実装で安定した結果になるよう検証順序を固定する。

1. JSON構文またはJavaScript値モデルを検証する。
2. ルートobjectと `version` を検証する。
3. 共通エンベロープの必須フィールド、型、値表現を検証する。
4. `payload` / `protectedPayload` の存在、排他、使用可能typeを検証する。
5. 標準typeの場合はtype固有payloadを仕様上のフィールド順で検証する。
6. 保護・復元処理ではprovider対応可否、プロファイル固有パラメータ、安全ポリシーの順に検証してから暗号処理を行う。

同じフィールドが複数の条件に該当する場合は、より具体的なコードを使用する。例えばhexフィールドの文字列表現が不正なら `INVALID_FIELD_VALUE` ではなく `INVALID_HEX`、閉じた標準値が許可値外なら `INVALID_STANDARD_VALUE` を使用する。

条件付きの必須・禁止フィールドには次のerror codeと `path` を使用する。

- `sign-response` の `replyTo`、`payload.result`、承認時の `payload.signature` が欠落している場合は `MISSING_REQUIRED_FIELD` とし、それぞれ `/replyTo`、`/payload/result`、`/payload/signature` を設定する。
- `sign-response` の `payload.result` が `approved` または `rejected` 以外の場合は `INVALID_STANDARD_VALUE` とし、`/payload/result` を設定する。
- `sign-response` の承認時の `payload.signature` がhex表現でない場合は `INVALID_HEX` とし、`/payload/signature` を設定する。
- `sign-response` の拒否時に `payload.signature` が存在する場合は `INVALID_FIELD_VALUE` とし、`/payload/signature` を設定する。
- `connection-response` の拒否時に `payload.address` または `payload.publicKey` が存在する場合は `INVALID_FIELD_VALUE` とし、それぞれ `/payload/address` または `/payload/publicKey` を設定する。両方が存在する場合は、payloadのフィールド定義順に従い `/payload/address` を先に報告する。

`path` はJSON Pointer形式とする。フィールド単体に帰属できる場合は必ず設定し、`PAYLOAD_CONFLICT` のような複数フィールド間の制約では省略してよい。

`RESOURCE_LIMIT_EXCEEDED` は `ProtectionProvider` が自身の安全ポリシーに基づいて暗号処理を拒否した場合に使用する。`parse` / `validate` / `serialize` の入力サイズ上限をSNIFコアが固定するためのエラーではない。

エラー `message` は固定またはテンプレート化した安全な説明とし、元データを文字列連結して生成しない。

## 9. parse

```tsx
export function parse(input: string): SnifResult<SnifData>;
```

処理順序:

1. JSONとして解析する。
2. 共通エンベロープを検証する。
3. 標準typeの場合はtype固有payloadを検証する。
4. アプリケーション固有typeの場合はpayloadを不透明なJSON objectとして扱う。
5. 正常時は `SnifData` を返す。

`parse` は入力を補正しない。例えば `0x` 付きhex、大文字・小文字以外のhex文字、欠落必須フィールド、フォーマット上で許可値が限定されているフィールドの不正値を推測で変換しない。ただしhex英字の大文字・小文字はフォーマット仕様どおり双方を受理する。

## 10. validate

```tsx
export function validate(input: unknown): SnifResult<SnifData>;
```

`validate` は `JSON.parse` を行わない点を除き、`parse` と同じ形式検証規則を使用する。

`validate` がJSON値として受理する値は、次に限定する。

- `null`
- boolean
- string
- 有限のnumber
- JSON値のみを要素として持つArray
- JSON値のみをプロパティ値として持つplain object

plain objectは、通常のオブジェクトリテラル等で生成され、JSON objectとしてそのまま扱えるオブジェクトを指す。class instanceや組み込みオブジェクトをplain objectとして扱わない。

次の値はJSON値として受理しない。

- `NaN`、`Infinity`、`-Infinity`
- `undefined`、`bigint`、function、symbol
- `Date`、`Map`、`Set`、typed array等の組み込みオブジェクト
- class instance
- 循環参照
- sparse array等、JSON化によって値が暗黙に変化する構造

JSONのネイティブ型で直接表現できない値をSNIFで搬送する必要がある場合は、そのフィールドのフォーマット仕様として文字列表現等を明示的に定義する。例えばbyte列はSNIF v1ではhex文字列として定義している。`validate` は `bigint`、`Date`、byte列その他の入力値を暗黙に文字列へ変換しない。

- 正常時の `value` は入力オブジェクトをdeep cloneしない。同じ参照を型付けされた `SnifData` として返してよい。
- 仕様で定義されたフィールドについて、必須性、JSON型、hex表現、排他等の形式規則を検証する。
- 仕様で定義されていない追加フィールドは、存在のみを理由としてSNIFコアでは拒否しない。意味付け、受理、拒否の運用ポリシーは利用側アプリケーションが決定する。
- アプリケーション固有typeの `payload` 内部は任意のJSON objectとして扱い、SNIFコアは意味を解釈しない。ただし、その値自体は上記JSON値の範囲に収まらなければならない。
- `kdf.params` 内部は暗号プロファイル固有のJSON objectとして扱う。ただし、その値自体は上記JSON値の範囲に収まらなければならない。

## 11. serialize

```tsx
export function serialize(data: SnifData): SnifResult<string>;
```

`serialize` は先に `validate` と同一の形式検証を行い、正常なSNIFデータだけをJSON文字列へ変換する。

- JSON canonicalizationは行わない。
- JSON文字列のプロパティ順をAPI契約としない。
- byte列を別表現へ変換しない。hex文字列はhex文字列のまま出力する。
- `account` / `mnemonic` の平文payloadを自動暗号化しない。
- `transaction.action` 等の処理意図を自動実行しない。
- `id` を自動生成しない。

## 12. 型判定ヘルパー

wire formatを増やさない純粋な判定ヘルパーのみ公開する。

```tsx
export function isStandardType(
  type: string,
): type is StandardSnifType;

export function isProtected(
  data: SnifData,
): data is ProtectedAccountSnif | ProtectedMnemonicSnif;

export type ProtectionState = 'plain' | 'protected' | 'not-applicable';

export function getProtectionState(
  data: SnifData,
): ProtectionState;
```

`getProtectionState` は利用側が機密データの保護状態を明示するための補助であり、UI表示そのものは行わない。

## 13. 暗号provider境界

暗号方式を交換可能にするため、コアAPIは特定のcipher/KDF実装へ固定しない。グローバルなprovider registryも持たず、呼び出しごとに明示的なproviderを受け取る。

```tsx
export interface ProtectionProvider<TSecret = unknown> {
  supports(payload: ProtectedPayload): boolean;

  validate(
    payload: ProtectedPayload,
  ): SnifResult<void>;

  protect(
    plaintext: Uint8Array,
    secret: TSecret,
  ): Promise<SnifResult<ProtectedPayload>>;

  unprotect(
    payload: ProtectedPayload,
    secret: TSecret,
  ): Promise<SnifResult<Uint8Array>>;
}
```

providerの責務:

- `cipher`、`kdf.name`、`kdf.params` 等のプロファイル固有規則を検証する。
- 復号前にKDFコスト等の危険なパラメータを検証し、provider自身が許容する処理範囲を超える場合は拒否する。
- salt、nonce等を内部生成する場合は暗号学的に安全な乱数源を使用する。
- secret、導出鍵、平文、復号済みpayloadをログ・例外・診断出力へ含めない。
- 認証失敗時に入力値や内部鍵情報を返さない。

SNIFコアはprovider固有の例外をそのまま外部へ公開せず、対応する `SnifErrorCode` へ変換する。

## 14. protect

```tsx
export type PlainProtectableSnif =
  | PlainAccountSnif
  | PlainMnemonicSnif;

export type ProtectedSnif =
  | ProtectedAccountSnif
  | ProtectedMnemonicSnif;

export async function protect<TSecret>(
  data: PlainProtectableSnif,
  secret: TSecret,
  provider: ProtectionProvider<TSecret>,
): Promise<SnifResult<ProtectedSnif>>;
```

処理規則:

1. `data` が平文の `account` または `mnemonic` であることを形式検証する。
2. type固有の `payload` JSON全体をJSON文字列化し、UTF-8 byte列へ変換する。
3. byte列と `secret` をproviderへ渡す。
4. providerが返した `ProtectedPayload` を形式検証する。
5. 元の共通エンベロープを保持し、`payload` を除去して `protectedPayload` を設定した新しいオブジェクトを返す。

`protect` は元オブジェクトを変更しない。`id`、`replyTo`、`chain`、`network`、`generationHashSeed` を自動変更しない。

## 15. unprotect

```tsx
export async function unprotect<TSecret>(
  data: ProtectedSnif,
  secret: TSecret,
  provider: ProtectionProvider<TSecret>,
): Promise<SnifResult<PlainProtectableSnif>>;
```

処理規則:

1. `data` が保護済み `account` / `mnemonic` であることを形式検証する。
2. `provider.supports` で対象プロファイルを扱えることを確認する。
3. `provider.validate` を暗号処理開始前に実行する。
4. providerで復号する。
5. 復号byte列をUTF-8 JSONとして解析する。
6. 元のtypeに対応するpayload構造だけを検証する。
7. 元の共通エンベロープを保持し、`protectedPayload` を除去して `payload` を設定した新しいオブジェクトを返す。

認証タグ不一致、誤ったsecret、ciphertext破損等を外部から一意に識別する必要はなく、認証付き暗号の検証失敗は `AUTHENTICATION_FAILED` として安全にまとめてよい。

復号後payloadが対象typeの構造として不正な場合は `DECRYPTED_PAYLOAD_INVALID` とする。

## 16. 機密データのメモリ取り扱い

JavaScript実行環境では、文字列やGC管理メモリの完全な消去を保証できない。APIは次を実装上の要件とする。

- 不要なdeep cloneを避ける。
- 内部で作成した一時 `Uint8Array` は処理後に上書き可能な範囲でゼロ化する。
- 秘密情報をエラー、ログ、telemetryへ含めない。
- providerへ渡した `secret` の所有権は呼び出し元に残し、コアAPIが保存しない。
- secretの型、生成、永続保存、削除方法はproviderおよび呼び出し元の責任とする。
- 完全消去を保証するAPI名称または説明を用いない。

## 17. 入力サイズ・処理資源の制限

SNIF APIは汎用的な入力サイズ・処理資源の固定上限を定義しない。

利用環境、搬送手段および運用条件に応じた入力サイズ・処理量等の制限は利用側アプリケーションが適用する。

暗号処理については、利用する `ProtectionProvider` が受領したアルゴリズム・KDFパラメータを実行前に検証し、自身が許容する処理範囲を超える場合は拒否する。

これらの運用上限は、SNIFフォーマットとして定める必須フィールド、型、hex表現、`payload` / `protectedPayload` の排他等の形式制約とは別の責任として扱う。

KDF work factor、暗号方式固有サイズ等の許容上限はprovider側の安全ポリシーとして検証する。SNIF APIはその固定上限値を共通仕様として定義しない。

## 18. 形式検証の境界

| 対象 | SNIF APIが検証する | SNIF APIが検証しない |
| --- | --- | --- |
| 共通エンベロープ | version、必須フィールド、JSON型、networkおよび存在するid/replyToの非空、hex表現、payload排他 | id/replyToの存在・期限・使用済み状態 |
| chain/network | chainが文字列であること、networkが非空文字列であること | 標準値以外の受理方針、実在性、組み合わせの有効性、ノードとの一致 |
| address/contact | 必須フィールド、型、publicKeyのhex表現 | checksum、鍵との関係、真正性 |
| account | privateKey/publicKeyのhex表現、addressの文字列型、保護状態 | 鍵長、鍵導出、公開鍵・アドレスとの関係 |
| mnemonic | payload構造、保護状態 | 単語リスト、言語、seed導出、復元可能性 |
| transaction | payloadのhex表現、actionが存在する場合の文字列型、`sign` の `id`、`sign-response` の `replyTo` / `result` / 承認時のhex形式の `signature`、拒否時の `signature` 不在 | 要求・応答の参照先の存在、未知actionの受理方針、トランザクション構文・意味、署名状態、action実行可否 |
| connection | requestの必須`url` / `permissions`、各フィールドの型、responseの`status`標準値 | 未知permissionの受理方針、送信者真正性、permissionと応答の対応、セッション状態 |
| protectedPayload | 共通構造、hex表現、使用可能type、標準暗号プロファイルの必須項目・`kdf.params` の型・nonce/tagのbyte長 | provider固有の暗号パラメータ妥当性、KDFコスト等の実行資源ポリシー |
| custom type | 共通エンベロープ、payloadがJSON objectであること | payload内部の意味・相互運用性 |

## 19. 未知値・追加フィールドの扱い

フォーマット設計書の責任境界に従い、未知プロパティ、未知の `type` / `action` / `permission`、およびJSON重複キーの扱いをSNIFコアの共通ポリシーとして固定しない。

- 標準7type以外の `type` はアプリケーション固有typeとして扱い、標準typeとして暗黙に処理しない。
- `action` / `permission` は文字列として搬送できる。標準値は `STANDARD_TRANSACTION_ACTIONS` / `STANDARD_CONNECTION_PERMISSIONS` で識別できるが、未知値を受理・拒否するかは利用側が決定する。
- 仕様で定義されていない追加フィールドはSNIFコアが意味を解釈しない。利用側は必要に応じて独自ポリシーで拒否できる。
- `parse` は通常のJSON解析を行い、JSON重複キーを独自検出しない。重複キーを拒否する必要がある利用側は `parse` 前にそのポリシーを適用する。
- 既知の必須フィールドについては定義されたJSON型を要求するため、例えば文字列必須フィールドの `null` は形式エラーとなる。その他の `null` の扱いは利用側ポリシーに委ねる。

`kdf.params` とアプリケーション固有typeの `payload` 内部は、それぞれ暗号プロファイルまたはアプリケーション側が意味を定義する。

## 20. 例外・ログ・診断

- コアAPIは内部loggerを持たず、受領SNIFデータを自動ログ出力しない。
- 公開エラーに入力値を含めない。
- providerがthrowした場合、コアはproviderのmessage/causeを公開エラーへコピーしない。
- `privateKey`、`mnemonic`、`secret`、導出鍵、復号済みpayload、ciphertextの全文を診断出力しない。
- 呼び出し側が独自にログを取る場合の安全性は呼び出し側の責任である。

## 21. 非同期性

`parse` / `validate` / `serialize` / 型判定ヘルパーは同期APIとする。

`protect` / `unprotect` は、KDFや暗号実装がWebCrypto、ネイティブ実装、WASM等の非同期APIを利用できるよう `Promise` を返す。

## 22. APIが自動実行しないこと

次の処理は、フィールド名や `action` / `status` の値に関係なく自動実行しない。

- トランザクション表示、署名、連署、アナウンス
- 接続承認、拒否、セッション確立
- permissionに応じた情報取得
- URLやアイコンの取得
- replyToによる要求検索
- リプレイ・重複チェック
- chain/network/generationHashSeedに基づくノード接続
- 秘密情報の保存

これらは必ず利用側アプリケーションが別の責任として実装する。

## 23. 公開export

v1のルート公開exportは次のカテゴリに限定する。

- constants: `SNIF_VERSION`, `STANDARD_CHAINS`, `STANDARD_NETWORKS`, `STANDARD_TYPES`, `STANDARD_TRANSACTION_ACTIONS`, `STANDARD_CONNECTION_PERMISSIONS`
- core: `parse`, `validate`, `serialize`
- protection: `protect`, `unprotect`, `ProtectionProvider`, `standardProtectionProvider`
- guards: `isStandardType`, `isProtected`, `getProtectionState`
- types: 本書で定義するSNIFデータ型、payload型、result/error型

標準type別builder、暗号providerのグローバル登録API、transport adapter、chain SDK adapterはv1コアのexportに含めない。

## 24. 適合テスト観点

最低限、次を同じ入力・同じ期待結果として実装間で比較できるようにする。

- 標準7typeの正常なparse / validate / serialize
- アプリケーション固有typeの正常系
- 未対応versionの拒否
- 必須フィールド欠落
- 不正JSON型
- `payload` / `protectedPayload` 同時指定
- `account` / `mnemonic` 以外での `protectedPayload`
- 奇数長hex、`0x` prefix、非hex文字の拒否
- hex英字の大文字・小文字の受理
- transactionの未知actionを文字列として保持し、標準actionとして暗黙処理しないこと
- transactionの `sign` / `sign-response` を区別し、署名応答の `approved` / `rejected`、承認時のsignature必須および拒否時のsignature禁止を検証すること
- `sign-response` の承認時に非hexの `payload.signature` を拒否し、`INVALID_HEX` と `/payload/signature` を返すこと
- `sign-response` の拒否時の `payload.signature`、および `connection-response` の拒否時の `address` / `publicKey` を拒否し、`INVALID_FIELD_VALUE` とそれぞれ `/payload/signature`、`/payload/address`、`/payload/publicKey` を返すこと
- `sign` / `sign-response` の `payload.payload` をhex decodeしたbyte列が署名対象であり、JSON envelope、JSON文字列、`action`、`generationHashSeed` を暗黙に署名対象へ追加しないこと
- connection-requestの未知permissionを文字列として保持し、標準permissionとして暗黙処理しないこと
- connection-requestで `url` / `permissions` を必須とし、`name` / `icon` / `note` を任意として扱うこと
- connection-responseの不正statusの拒否
- rejected responseへのaddress/publicKey混入の拒否
- NEMデータに `generationHashSeed` が存在しても、その組み合わせだけを理由として形式エラーにしないこと
- 未定義追加フィールドを存在のみで拒否せず、SNIFコアが意味を解釈しないこと
- custom payload内部の任意JSON object保持
- provider未対応時の `UNSUPPORTED_PROTECTION`
- providerの安全ポリシー超過時の `RESOURCE_LIMIT_EXCEEDED`
- 認証失敗時の `AUTHENTICATION_FAILED`
- 復号後payload構造不正時の `DECRYPTED_PAYLOAD_INVALID`
- 標準暗号providerの固定fixtureをNode.js、ブラウザ、React Native、Expoで相互に生成・復元できること
- エラーに秘密情報が含まれないこと

## 25. フォーマット要件との対応

| 要件 | API上の対応 |
| --- | --- |
| FMT-001 | `parse` / `serialize` はSNIF v1のJSON wire formatを扱う。JSON canonicalizationは行わず、文字列のプロパティ順・空白等の同一性を保証しない。 |
| FMT-002 | `HexString` と形式検証により、byte列として定義されたフィールドをhex文字列として扱う。Base64等の別表現への自動変換は行わない。 |
| FMT-003 | `SnifEnvelopeBase` に `version` / `type` / `chain` / `network` と任意の `generationHashSeed` / `id` / `replyTo` を定義し、`parse` / `validate` で形式検証する。 |
| FMT-004 | `STANDARD_CHAINS` / `STANDARD_NETWORKS` で標準値を公開しつつ、`chain` / `network` 自体は文字列としてアプリケーション定義値を受理する。 |
| FMT-005 | `StandardSnifType`、標準7typeの各公開型、`STANDARD_TYPES` および `isStandardType` により標準typeを明示的に識別する。 |
| FMT-006 | 標準7typeのpayload型と `parse` / `validate` により、必須・任意、JSON型、hex表現、排他等の形式規則を検証する。 |
| FMT-007 | `CustomSnif` により標準7type以外のtypeとJSON object payloadを扱い、`isStandardType` で標準typeとの混同を防ぐ。payload内部の意味は解釈しない。 |
| FMT-008 | `AccountSnif` / `MnemonicSnif` を平文・保護済みのunionとして定義し、`payload` / `protectedPayload` を排他的に扱う。`isProtected` / `getProtectionState` で保護状態を判別できる。 |
| FMT-009 | `ProtectedPayload` / `KdfDescriptor` と `ProtectionProvider` により、payload全体の保護に必要なcipher、KDF、salt、KDFパラメータ、nonce、ciphertext、tagを搬送・処理する。 |
| FMT-010 | `TransactionPayload` はトランザクション本体をhexで保持し、任意の `action` を処理意図として扱う。`sign` と `sign-response` を区別し、署名応答では `result` により承認・拒否を表現し、承認時だけ署名関連情報を搬送できる。APIは署名・連署・アナウンス等を実行せず、actionの実行可否も判定しない。 |
| FMT-011 | `ConnectionRequestSnif` / `ConnectionResponseSnif` により接続要求・応答を表現する。APIは接続セッション、認証、認可、利用者承認を成立させず、要求元情報の真正性も保証しない。 |
| FMT-012 | 共通エンベロープの `id` / `replyTo` をそのまま保持・搬送する。APIは識別子の生成、参照先の存在、期限、使用済み状態、重複状態を管理・検証しない。 |
| FMT-013 | `sign` は `id` と署名対象データを要求として扱い、`sign-response` は `replyTo` と `result` で承認・拒否を表現する。承認時は署名関連情報を必須とし、拒否時は署名関連情報を受け付けない。 |
| FMT-014 | `sign` / `sign-response` の `payload.payload` をhex decodeしたbyte列を署名対象として保持し、APIはそのbyte列を変更せず、署名の生成・検証は実行しない。 |
| SEC-001 | `standardProtectionProvider` がv1標準のAES-256-GCM + Argon2idプロファイルを実装し、`account` / `mnemonic` のpayload全体を認証付き暗号で保護・復元する。 |
| SEC-002 | `ProtectedPayload` に `cipher`、`kdf.name`、`kdf.salt`、`kdf.params` 等を保持し、復元に必要な暗号プロファイルを識別できる。`ProtectionProvider` を明示的に渡す構成により別プロファイルへ差し替え可能とする。 |
| SEC-003 | パスワード等のsecretは `protect` / `unprotect` 呼び出し時にproviderへ渡し、SNIFデータへ格納しない。secretの生成・保存・管理はproviderおよび呼び出し元の責任とする。 |
| SEC-004 | SNIF APIは暗黙のAADや外側エンベロープとの暗号学的bindingを追加せず、`protectedPayload` の認証成功を共通エンベロープ、送信者、dApp、URL等の真正性保証として扱わない。 |
| LIB-001 | `parse` / `validate` / `serialize` / `protect` / `unprotect` により、共通エンベロープ、標準7type、custom typeおよびprotectedPayloadを定義された形式で扱う。 |
| LIB-002 | APIは形式検証の結果を返すが、チェーン上・業務上の妥当性、送信者の真正性、署名の有効性、利用者承認、状態管理または処理実行を保証しない。 |
| LIB-003 | エラー、ログ、provider例外の公開情報および診断情報に秘密鍵、ニーモニック、パスワード等の秘密情報を含めない。 |

要件定義の受け入れ条件 `AC-001〜AC-011` は、第24章の適合テスト観点で確認する。

## 26. 対応実行環境・配布形式

SNIF v1は次の実行環境を正式サポートする。

- Node.js
- ブラウザ
- React Native
- Expo

複数環境で同一のAPIを利用できることを優先し、SNIFコアはNode.js固有APIへ依存しない。`node:` 組み込みモジュール、`Buffer`、`process` 等のNode.js固有機能をコアAPIの前提としない。

配布形式はES Modules（ESM）のみとする。CommonJS（CJS）形式および `require()` による利用はv1の正式サポート対象外とする。

実行環境固有の機能が必要な処理は、コアAPIへ取り込まず、差し替え可能な境界または利用側アプリケーションの責任として扱う。

## 27. v1標準暗号provider

SNIF v1は標準暗号providerとして、フォーマット設計書で定義する `AES-256-GCM + Argon2id` プロファイルを実装する。

```tsx
export const standardProtectionProvider: ProtectionProvider<string>;
```

標準providerはpassword文字列をsecretとして受け取り、`aes-256-gcm` + `argon2id` プロファイルの生成・復元を担当する。標準プロファイルでは `cipher`、`kdf.name`、`kdf.salt`、`kdf.params`、`nonce`、`ciphertext`、`tag` を必須とし、`kdf.params` には `version`、`memoryCost`、`timeCost`、`parallelism` を要求する。`protect` / `unprotect` 自体はproviderを暗黙選択せず、標準providerを使用する場合も呼び出し側が明示的に渡す。

標準providerが新規に保護データを生成する際のArgon2idパラメータは次のとおりとする。

- `version`: `19`
- `memoryCost`: `65536` KiB
- `timeCost`: `3`
- `parallelism`: `1`
- salt長: `16` bytes
- 導出鍵長: `32` bytes
- password文字列はUnicode正規化を行わずUTF-8 byte列へ変換する。

`protectedPayload.kdf.params` には `version`、`memoryCost`、`timeCost`、`parallelism` を格納する。salt長は `kdf.salt` 自体から判別でき、導出鍵長は `AES-256-GCM` 用の32 bytesに固定されるため保存しない。

新規生成するsaltおよび暗号方式が要求するnonceは、暗号学的に安全な乱数源から生成する。

復号時は受領した `protectedPayload` に記録されたKDFパラメータを使用する。ただし標準providerは暗号処理開始前にパラメータを検証し、自身が許容する処理範囲を超える場合は拒否する。

標準providerの存在は `ProtectionProvider` の交換可能性を制限しない。利用側は別の `ProtectionProvider` を明示的に指定できる。

AES-GCMのv1標準値は次のとおりとする。

- `nonce`: `12` bytes（96 bit）
- `tag`: `16` bytes（128 bit）

標準providerは新規生成時に12 bytesのnonceを暗号学的に安全な乱数源から生成し、16 bytesの認証tagを生成する。復号時は暗号処理開始前に `nonce` が12 bytes、`tag` が16 bytesであることを検証し、標準プロファイルに一致しない場合は拒否する。

## 28. 完了条件

API仕様は次を満たした時点で実装へ移行できる。

- フォーマット設計書の標準7typeを追加・欠落なく型で表現できる。
- 形式検証と意味検証の責任境界がAPIごとに一意である。
- 未知typeを暗黙に標準処理しない。
- `account` / `mnemonic` の平文・保護済みを明示的に区別できる。
- 特定暗号実装に固定せず保護処理を差し替えられる。
- 外部入力不正を安全なerror codeで返し、秘密情報を漏えいしない。
- 入力サイズ・処理量等の運用上限を利用側アプリケーションの責任として分離している。
- 暗号処理では `ProtectionProvider` が実行前に自身の許容範囲を検証する。
- API都合でwire formatの意味または標準typeを増やしていない。
- v1標準暗号providerのcipher/KDFプロファイル、KDF生成時パラメータ、AES-GCMのnonce長・tag長が確定している。
