# @nemnesia/snif

Symbol と NEM のデータを、搬送方法に依存せず交換するための SNIF（Symbol/NEM Interchange Format）v1 ライブラリです。SNIF v1 は JSON を wire format とし、標準データタイプ、アプリケーション固有タイプ、`account`／`mnemonic` の保護済み表現を扱えます。

このパッケージは ESM として提供され、入力の形式検証結果を例外ではなく機械判定可能な `SnifResult` で返します。

## インストール

```bash
pnpm add @nemnesia/snif
```

Node.js 20 以上が必要です。

## 基本的な使い方

JavaScript値は `validate`、JSON文字列は `parse` で検証できます。検証済みのデータは `serialize` で JSON 文字列へ変換できます。

```typescript
import { parse, serialize, validate } from '@nemnesia/snif';
import type { AddressSnif } from '@nemnesia/snif';

const data = {
  version: 1,
  type: 'address',
  chain: 'symbol',
  network: 'mainnet',
  payload: { address: 'SYMBOL-ADDRESS' },
} satisfies AddressSnif;

const validated = validate(data);
if (!validated.ok) {
  console.error(validated.error.code, validated.error.path);
} else {
  const serialized = serialize(validated.value);
  if (serialized.ok) {
    const parsed = parse(serialized.value);
    if (parsed.ok) console.log(parsed.value);
  }
}
```

`serialize` は入力を検証してから `JSON.stringify` を実行します。JSON canonicalization、識別子の自動生成、処理意図の自動実行は行いません。

## 簡易フォーマット仕様

SNIF v1のwire formatはJSONです。JSONのcanonicalizationは行わず、JSON上のbyte列は `0x` プレフィックスのない偶数長のhex文字列で表します。

すべてのデータは、次の共通エンベロープを持ちます。

```json
{
  "version": 1,
  "type": "address",
  "chain": "symbol",
  "network": "mainnet",
  "payload": {
    "address": "SYMBOL-ADDRESS"
  }
}
```

- `version`: SNIF v1では `1`。
- `type`: データタイプ。標準タイプ以外の文字列も使用できます。
- `chain`: 標準値は `symbol` と `nem` です。その他の文字列も指定できます。
- `network`: `mainnet`、`testnet` などの非空文字列です。
- `generationHashSeed`、`id`、`replyTo`: 必要な場合に指定する任意の文字列です。`generationHashSeed` はhex文字列、`id` と `replyTo` は空でない文字列でなければなりません。
- `payload`: 平文データ。`account`／`mnemonic` の保護時を除き必須です。
- `protectedPayload`: `account` または `mnemonic` の保護時だけ使用します。`payload` と同時には使用できません。

SNIF v1で定義されている標準タイプとpayloadの概要は次のとおりです。

| `type`                | `payload`の主な項目                                                 |
| --------------------- | ------------------------------------------------------------------- |
| `address`             | 必須: `address`                                                     |
| `contact`             | 必須: `name`。任意: `address`、`publicKey`、`note`、`icon`          |
| `account`             | 平文時の必須項目: `privateKey`、`publicKey`、`address`              |
| `mnemonic`            | 平文時の必須項目: `mnemonic`                                        |
| `transaction`         | 必須: `payload`。任意: `action`、`result`、`signature`              |
| `connection-request`  | 必須: `url`、`permissions`。任意: `name`、`icon`、`note`            |
| `connection-response` | 必須: `status`。`approved` 時は任意で `address`、`publicKey` を返却 |

`account` と `mnemonic` を保護する場合は、平文の `payload` の代わりに次のような `protectedPayload` を指定します。

次の値は構造を示す説明用です。実際の保護処理ではproviderが生成した値を使用してください。

```json
{
  "cipher": "aes-256-gcm",
  "kdf": {
    "name": "argon2id",
    "salt": "00000000000000000000000000000000",
    "params": {
      "version": 19,
      "memoryCost": 65536,
      "timeCost": 3,
      "parallelism": 1
    }
  },
  "nonce": "000000000000000000000000",
  "ciphertext": "00",
  "tag": "00000000000000000000000000000000"
}
```

標準暗号プロファイルでは、`cipher` は `aes-256-gcm`、`kdf.name` は `argon2id` です。`salt`、`nonce`、`ciphertext`、`tag` はhex文字列で、`salt` は16 bytes、`nonce` は12 bytes、`tag` は16 bytesです。`payload` と `protectedPayload` は同時に指定できません。

標準タイプ以外の `type` では、`payload` にアプリケーション固有の JSON object を格納できます。

`connection-response` の `status` は `approved` または `rejected` です。`rejected` の場合、`address` と `publicKey` は指定できません。

byte列は、`0x` プレフィックスを付けない偶数長のhex文字列で表します。SNIFはアドレス、鍵、トランザクション、`generationHashSeed` のチェーン上・業務上の妥当性までは検証しません。

### transactionの処理意図

`transaction` の `payload.action` には、次の標準値を使用できます。

`display`、`sign`、`sign-response`、`cosign`、`announce`、`sign-and-announce`、`cosign-and-announce`

未知のaction文字列も形式上は扱えます。`sign` では共通エンベロープの `id`、`sign-response` では `replyTo` が必要です。`action` は処理意図を表す値であり、署名、連署、アナウンスなどの処理を実行または保証するものではありません。

## `account`／`mnemonic` の保護

平文の `account` または `mnemonic` payload全体を、指定した `ProtectionProvider` で保護・復元できます。標準providerは Argon2id と AES-256-GCM を使用します。

```typescript
import { protect, standardProtectionProvider, unprotect } from '@nemnesia/snif';
import type { PlainAccountSnif } from '@nemnesia/snif';

const account = {
  version: 1,
  type: 'account',
  chain: 'symbol',
  network: 'testnet',
  payload: {
    privateKey: '00',
    publicKey: '11',
    address: 'SYMBOL-ADDRESS',
  },
} satisfies PlainAccountSnif;

// 実際のアプリケーションでは、十分に強いsecretを安全な方法で取得してください。
const secret = 'example-passphrase';
const protectedResult = await protect(account, secret, standardProtectionProvider);

if (protectedResult.ok) {
  const restored = await unprotect(protectedResult.value, secret, standardProtectionProvider);
  if (restored.ok) console.log(restored.value.type);
}
```

標準providerの新規保護では、Argon2id v19（memory cost 65536 KiB、time cost 3、parallelism 1）で鍵を導出し、AES-256-GCMで保護します。secretはSNIFデータに保存されません。保護済みデータの認証成功は、外側のエンベロープ、送信者、URLなどの真正性を保証しません。

標準provider以外の暗号方式を使う場合は、`ProtectionProvider<TSecret>` の `supports`、`validate`、`protect`、`unprotect` を実装して渡します。

保護状態は次のAPIで確認できます。

```typescript
import { getProtectionState, isProtected } from '@nemnesia/snif';
import type { SnifData } from '@nemnesia/snif';

function inspectProtection(data: SnifData): void {
  getProtectionState(data); // 'plain' | 'protected' | 'not-applicable'
  isProtected(data); // account / mnemonic の保護済み表現かどうか
}
```

## エラー処理

公開APIは次のResult型を返します。

```typescript
type SnifResult<T> = { ok: true; value: T } | { ok: false; error: SnifError };
```

失敗時は `error.code` で機械的に分類し、形式検証に関するエラーでは `error.path` に JSON Pointer 形式の場所が含まれることがあります。

```typescript
const result = parse('{');
if (!result.ok) {
  result.error.code; // 'INVALID_JSON'
  result.error.message; // 公開用メッセージ
}
```

主なエラーコードには `INVALID_JSON`、`MISSING_REQUIRED_FIELD`、`INVALID_FIELD_TYPE`、`INVALID_HEX`、`PAYLOAD_CONFLICT`、`AUTHENTICATION_FAILED`、`DECRYPTED_PAYLOAD_INVALID` があります。利用可能なコードの一覧は、公開されている `SnifErrorCode` 型を参照してください。

## 公開API

- `parse(input)` — JSON文字列を解析し、SNIF v1として検証
- `validate(input)` — JavaScript値をSNIF v1として検証
- `serialize(data)` — SNIFデータを検証してJSON文字列へ変換
- `protect(data, secret, provider)` / `unprotect(data, secret, provider)` — 機密payloadを保護・復元
- `isProtected(data)` / `getProtectionState(data)` — `account`／`mnemonic` の保護状態を判定
- `standardProtectionProvider` — Argon2id + AES-256-GCMの標準provider
- `isStandardType(type)` — 標準typeかどうかを判定
- `SNIF_VERSION`、`STANDARD_*` — SNIF v1のバージョン、標準値一覧
- 各SNIFデータ、provider、Result、エラーのTypeScript型

## 責任範囲

SNIFはデータ交換フォーマットであり、QR、Deep Link、NFC、Clipboard、HTTP、WebSocketなどの搬送処理は提供しません。また、次の処理も行いません。

- アドレス、公開鍵、秘密鍵、ニーモニックの相互関係やチェーンとの対応の検証
- トランザクションの作成、意味検証、署名生成・検証、連署、アナウンス
- 利用者の承認、送信者やURLの真正性、認証・認可
- `id`／`replyTo` の存在確認、期限管理、リプレイ防止、重複実行防止

`account` と `mnemonic` は機密情報です。平文payload、secret、復元結果をログやエラー出力へ含めないでください。

## 関連資料

- [SNIF v1 フォーマット設計書](doc/spec-format.md)
- [SNIF v1 ライブラリAPI仕様書](doc/spec-api.md)
- [symbol-tools リポジトリ](https://github.com/nemnesia/symbol-tools)

## 開発

リポジトリのルートから次のコマンドを実行できます。

```bash
pnpm --filter @nemnesia/snif build
pnpm --filter @nemnesia/snif typecheck
pnpm --filter @nemnesia/snif lint
pnpm --filter @nemnesia/snif test
```
