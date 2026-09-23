---
name: readme-author
description: symbol-nem-wallet-core の README を、Cargo manifest、Rust / Native C ABI / WASM の公開 API、実装、仕様と照合して作成・更新する。READMEで仕様や将来機能を新規に決定しない。
---

# README Author

README は、利用者がこの Rust Wallet Core を安全に使い始めるための案内である。実装・公開契約・現在の制約を正確に伝え、仕様や設計を新規に決定する場所にはしない。

## 作業開始時に読む資料

次の順で、対象に必要な範囲を確認する。

1. `AGENTS.md`
2. `../author-common/author-playbook.md`
3. 対象 README と `Cargo.toml` / workspace manifest
4. Rust の公開 API、Native C ABI のヘッダー、WASM binding の公開定義
5. `src/`、`bindings/native/`、`pkg/`、関連テスト、build script
6. 対応する `docs/specifications/`、`docs/design/`、必要な公式資料
7. 既存レビューとユーザーが指定した修正内容

## 対象と変更境界

- ユーザーが指定した README、crate、binding、機能の範囲だけを対象にする。
- 指定がなければ既存のルート `README.md` を対象とする。新規 README の出力先は、対象 crate / binding の既存配置またはユーザー指定で確定する。
- README 以外のコード、Cargo manifest、仕様、設計、テストを変更して整合性を作らない。差異は事実、正本、要確認事項に分けて報告する。
- 既存 README の全面置換、章削除、リンク削除は、利用者への影響と根拠を確認してから行う。

## README に記載する内容

対象に必要な範囲で、次を利用者向けに整理する。

- crate / binding が提供する機能と対象範囲
- Rust crate の依存方法、Native C ABI の build / header、WASM の build / 生成物
- 最小限の実行例と公開 API の実在する名前、引数、戻り値、失敗時の扱い
- `WalletStoreBlob` / `PendingProfileBlob` の opaque byte 列、replacement Store の扱い、Native buffer の所有権など重要な利用契約
- Symbol / NEM、Mainnet / Testnet、Profile / Software Key の区別
- 現在利用できる機能、対象外、未実装・将来範囲、外部へ委ねる責任
- Mnemonic、秘密鍵、Profile password、署名 payload、Store を扱う際の security 注意
- MIT license と、詳細な仕様・設計・binding契約へのリンク

公開 API 一覧を作る場合は、Rust の `pub` surface、Native ヘッダー、WASM の生成定義に存在する項目だけを載せる。`pkg/` は生成物の例であり、公開の正本かどうかを manifest / build 手順で確認する。

## 事実確認

- crate 名、version、workspace member、features、依存関係は `Cargo.toml` と `Cargo.lock` で確認する。
- Rust API、戻り値、error code、warning、所有権は `src/` と仕様書で確認する。
- Native C ABI の symbol、header、borrowed input、owned output、free API は `bindings/native/include/`、`bindings/native/src/`、binding の設計・仕様で確認する。
- WASM の export、`Uint8Array`、初期化、生成コマンドは `src/wasm.rs`、`scripts/build-wasm.sh`、生成定義、仕様で確認する。
- build、test、WASM target、Native C ABI 検証のコマンドは実際の script と `AGENTS.md` に従う。存在しない npm / pnpm script を書かない。
- 実装、仕様、README が異なる場合は、承認済み仕様を優先し、現在の実装が未達なら README だけで隠さない。
- 実行していない例や検証を、動作確認済みと表現しない。

## プロジェクト固有の境界

- Symbol と NEM の鍵、公開鍵、address、署名、chain 処理を一括りにしない。
- Mainnet と Testnet を暗黙に変換しない。Profile の Network と指定 Chain の組合せを仕様どおりに説明する。
- Rust Core が鍵管理、Mnemonic validation、暗号化、導出、署名、Wallet Store を所有する場合、Native / WASM binding に同じ処理を再実装したように書かない。
- `sign` が raw byte 列を解釈しない契約なら、Transaction 構築・表示・announce を提供するように誤解させない。
- `WalletStoreBlob`、`PendingProfileBlob`、private key、Mnemonic をアプリケーションが編集・ログ出力する例を載せない。
- 秘密情報、実運用 credential、復号済みデータを、例、ログ、fixture、スクリーンショットへ含めない。

## 作業手順

1. 対象 README、読者、変更目的を確定する。
2. manifest、公開 surface、実装、仕様、binding header、scripts、テストから現在の事実を収集する。
3. 既存記載を、正確、古い、根拠なし、欠落に分類する。
4. 概要、対応範囲、導入、最小利用、API、制約・安全性、開発・検証、関連資料の順に整理する。
5. コード例、コマンド、リンク、用語、license を根拠と照合する。
6. 外部可視仕様を README だけで拡張していないことを確認し、README だけを更新する。

## 標準構成

対象に不要な章は省くが、次を基準にする。

1. 概要と対象
2. 現在の対応範囲と対象外
3. Rust / Native / WASM の導入
4. 最小利用例
5. 主要 API とデータの扱い
6. 制約とセキュリティ
7. 開発・検証コマンド
8. license と関連資料

## 完了条件

- README の重要な主張が manifest、コード、仕様、設計、テスト、script のいずれかへ追跡できる。
- Rust crate、Native C ABI、WASM binding の境界と、現在機能 / 将来機能が明確である。
- Symbol / NEM、Mainnet / Testnet、raw bytes / text、borrowed / owned buffer を誤認させない。
- 秘密情報を含まず、未実行の検証を成功扱いしていない。
- README 以外のファイルを変更していない。

## 作業完了後の Git 運用

`../author-common/author-playbook.md` の「完了と Git」を適用する。
