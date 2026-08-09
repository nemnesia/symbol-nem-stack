# 変更履歴

`@nemnesia/symbol-sdk` における主な変更を記録します。

このパッケージは Symbol 公式 SDK を基にした派生版です。上流の変更取り込みと、このパッケージ固有の変更を区別して記載します。

## 未リリース

### 変更

- Node.js 26 の Web Crypto が返す復号エラーに対応し、メッセージ復号のテストを環境依存のエラー文言に依存しない形へ更新した。
- README に、非同期の `MessageEncoder` API と `await` を使用する暗号化・復号の例を追加した。

## [3.3.2-pure.2] - 2026-07-16

### 追加

- Symbol 公式 SDK v3.3.2 の変更を取り込んだ。
- Symbol と NEM の手数料計算 API を公開した。
- `symbol-sdk/nem` の公開エントリを追加した。

### 変更

- `rawDescriptor` の型を `object` から `any` に修正した。
- パッケージを npm alias でインストールする手順を README に記載した。

## [3.3.1] - 2026-04-18

### 追加

- 基本ユーティリティ、メッセージエンコーダー、Facade、Merkle 検証を含むテストを拡充した。

## [3.3.0-pure.1] - 2026-01-06

### 追加

- Node.js、モダンブラウザ、React Native で利用できる派生版として公開した。
- NEM 向け API を追加した。

### 変更

- Node.js 組み込みの暗号 API への依存を `@noble` 系および `@scure/bip39` へ移行した。
- 暗号化・復号に関わる `MessageEncoder` API を非同期化した。
- `Buffer` への依存を除去し、バイト列を `Uint8Array` で扱うようにした。
