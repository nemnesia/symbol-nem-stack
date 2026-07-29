# @nemnesia/simple-password-crypto

[![npm version](https://img.shields.io/npm/v/@nemnesia/simple-password-crypto.svg)](https://www.npmjs.com/package/@nemnesia/simple-password-crypto)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

パスワードベースでデータを暗号化・復号するライブラリです。Node.js と、Web Crypto (`crypto.getRandomValues`) を提供するブラウザ／React Native 環境に対応します。

> [!WARNING]
> このライブラリが提供できる保護強度の上限は、パスワードのエントロピーです。空のパスワードは拒否しますが、短い・推測可能なパスワードの強度判定はアプリケーションの責務です。ウォレット、ニーモニック、秘密鍵を扱う場合は、十分に強いパスフレーズのポリシーと OS のキーストアを併用してください。

## 特徴

- **現代的な暗号化**: Argon2id + AES-256-GCM
- **シンプルなAPI**: encrypt/decrypt の2つの関数のみ
- **セキュリティ重視**: ベストプラクティスに従った実装
- **マルチプラットフォーム対応**: Node.js、ブラウザ、React Native（CSPRNG を提供する環境）で動作
- **TPM不要**: ソフトウェアベースの暗号化
- **依存関係が少ない**: @noble/ciphers と @noble/hashes のみ

## インストール

```bash
npm install @nemnesia/simple-password-crypto
```

または

```bash
pnpm add @nemnesia/simple-password-crypto
```

または

```bash
yarn add @nemnesia/simple-password-crypto
```

## 使い方

### TypeScript/JavaScript での例

```typescript
import { decrypt, encrypt } from '@nemnesia/simple-password-crypto';

const plaintext = Buffer.from('秘密のデータ');
const password = '強力なパスワード';

const encrypted = await encrypt(plaintext, password);
// encrypted: { version, kdf, kdfParams, cipher, salt, ciphertext }

const decrypted = await decrypt(encrypted, password);
console.log(new TextDecoder().decode(decrypted)); // '秘密のデータ'
```

### JSON ストレージの例

```typescript
const json = JSON.stringify(encrypted);
const restored = JSON.parse(json);
const decrypted2 = await decrypt(restored, password);
```

### ブラウザでの例

```js
import { decrypt, encrypt } from '@nemnesia/simple-password-crypto';

// ...同様に利用可能
```

---

## API リファレンス

### `async encrypt(plaintext: Uint8Array, password: Password): Promise<EncryptedData>`

- `plaintext`: 暗号化するデータ（Uint8Array、Buffer、文字列は TextEncoder で変換）
- `password`: 空でないパスワード文字列、またはパスワードを UTF-8 等でエンコードした `Uint8Array`
- 戻り値: `{ version, kdf, kdfParams, cipher, salt, ciphertext }`
- 空のパスワードは拒否されます。最小長や複雑性のポリシーは用途に応じて呼び出し側で適用してください。

### `async decrypt(data: EncryptedData, password: Password, options?: DecryptOptions): Promise<Uint8Array>`

- `data`: 暗号化データオブジェクト
- `password`: `encrypt` と同じ空でないパスワード
- `options.allowLegacy`: 既定値は `false`。旧 `{ salt, ciphertext }` 形式を移行するときだけ `true` を指定
- 戻り値: 復号された Uint8Array
- パスワードやデータが不正な場合はエラーを throw

### `needsReencryption(data: EncryptedData | LegacyEncryptedData): boolean`

復号に成功したデータを、現在の既定 KDF パラメータで再暗号化すべきか判定します。旧形式は常に `true` です。認証前の入力に対する結果は信用せず、必ず復号成功後に利用してください。

### パスワードのバイト列と消去

JavaScript の文字列は GC 管理下のため、ライブラリから内容を確実に消去できません。より厳密な呼び出し元は `Uint8Array` を渡し、処理完了後に自ら消去できます。

```typescript
const password = new TextEncoder().encode(userSuppliedPassword);
try {
  const encrypted = await encrypt(secret, password);
  // encrypted を保存する
} finally {
  password.fill(0);
}
```

`Uint8Array` は呼び出し元が所有するバッファなので、ライブラリは自動消去しません。

#### `EncryptedData` 型

```typescript
interface EncryptedData {
  version: 1;
  kdf: 'argon2id';
  kdfParams: {
    memoryCost: 32768;
    timeCost: 2;
    parallelism: 1;
  };
  cipher: 'aes-256-gcm';
  salt: string; // Base64（16 バイト）
  ciphertext: string; // Base64（ノンス[12] + タグ[16] + 暗号文）
}
```

## 暗号方式

### 鍵導出関数（KDF）

- **Argon2id**: メモリハード関数、サイドチャネル攻撃に強い
  - メモリ: 32 MiB（32768 KiB）
  - 繰り返し回数: 2回
  - 並列度: 1
  - 実装: `@noble/hashes/argon2`（全環境で純粋 JS 実装を使用）

### 暗号アルゴリズム

- **AES-256-GCM**: 認証付き暗号、改ざん検出機能付き
  - 鍵長: 256 ビット
  - ノンス: 96 ビット（毎回ランダム生成）
  - タグ: 128 ビット
  - 実装: `@noble/ciphers`（全環境共通）

## データフォーマット詳細

- `salt`: Argon2id 用ソルト（毎回ランダム生成、16 バイト、Base64）
- `version`、`kdf`、`kdfParams`、`cipher`: 形式識別子。AES-GCM の AAD として認証される
- `ciphertext`: AES-GCM のノンス（12 バイト）+ タグ（16 バイト）+ 暗号文の連結（Base64）

復号は旧 `{ salt, ciphertext }` 形式を既定では拒否します。移行専用の経路でのみ `{ allowLegacy: true }` を指定してください。旧形式にはメタデータ認証がないため、復号後すぐに新形式で再暗号化してください。

```typescript
const plaintext = await decrypt(legacyData, password, { allowLegacy: true });
const migrated = await encrypt(plaintext, password);
```

KDF パラメータはデータごとに認証され、ライブラリが定義する許可済みセットだけが復号に使われます。既定値を将来強化しても、旧セットを許可リストに残すことで既存データを復号できます。`needsReencryption` が `true` のデータは、復号成功後に最新の既定値で再暗号化してください。

## 用途

- ウォレット秘密鍵の保護
- ユーザープロファイルの暗号化
- パスワード管理
- セキュアなローカルストレージ

## セキュリティ保証

- ノンス再利用の防止（毎回ランダム生成）
- 認証付き暗号（改ざん検出）
- 認証済みメタデータ（KDF・暗号方式・バージョンの改ざん検出）
- OWASP の Argon2id 最低推奨値を満たす KDF 設定（メモリ: 32 MiB、繰り返し: 2回、並列度: 1）

## セキュリティ保証の対象外

- 物理的攻撃（メモリダンプ、コールドブート攻撃）
- TPM/HSM レベルのハードウェアセキュリティ
- 弱いパスワードに対する保護
- JavaScript 文字列に含まれるパスワードの確実なメモリ消去

## 運用上の制約

平文は最大 16 MiB です。ただし各操作で Argon2id が 32 MiB を使用し、暗号文・Base64・コピー用のメモリも別途必要です。これはローカルウォレット、ブラウザ拡張、モバイルアプリなど、信頼されたユーザー操作を主な対象とする設計です。

未認証の外部入力をサーバーで並列・大量に復号する用途には、そのまま使用しないでください。キュー、同時実行数の制限、レート制限、リクエストサイズ制限をアプリケーション側で実装してください。

React Native では CSPRNG を提供する安全な polyfill またはランタイム設定が必要です。対応を掲げる配布対象（Hermes、Expo managed workflow、Web Worker、各ブラウザ）は、実際のアプリ構成と対象端末で CI を含めて検証してください。

## パフォーマンス

### 全環境（@noble/hashes）

| 操作   | 処理時間（目安） |
| ------ | ---------------- |
| 暗号化 | 約 2〜3 秒       |
| 復号   | 約 2〜3 秒       |

**パフォーマンスに関する注意**:
このライブラリは純粋 JavaScript で実装された `@noble/hashes` を使用します。Argon2id のメモリハード特性により、処理に数秒かかります。これはブルートフォース攻撃対策として意図的な設計です。

**推奨事項**:

- KDF はイベントループへ処理を譲る非同期実装ですが、端末性能に応じて時間がかかります。UI ではローディング表示を実装してください
- ブラウザ: Web Worker での実行を検討してください
- React Native: バックグラウンドスレッドでの実行を検討してください
- React Native: `crypto.getRandomValues` を提供する安全な polyfill を初期化してください

## テスト

```bash
pnpm test              # テスト実行
pnpm test:coverage     # カバレッジ
pnpm test:watch        # ウォッチモード
```

## ライセンス

MIT

## 関連リンク

- [Argon2](https://github.com/P-H-C/phc-winner-argon2)
- [AES-GCM](https://tools.ietf.org/html/rfc5288)
