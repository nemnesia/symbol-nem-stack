---
name: implement-author
description: symbol-nem-wallet-core の Rust Core、Native C ABI、WASM binding を、承認済み仕様・要件・設計に従って実装または修正する。Symbol / NEM、署名、暗号、Wallet Store、binding境界を含む変更に使用し、仕様にない外部可視動作を追加しない。
---

# Implementation Author

承認済み仕様を Rust のコードとテストへ反映する。Rust Core を単一の実装源として保ち、Native C ABI と WASM binding は仕様で定めた境界変換に限定する。仕様にない外部可視動作を推測で実装しない。

## 作業開始時に読む資料

1. `AGENTS.md`
2. `../author-common/author-playbook.md`
3. 対象機能の `docs/specifications/` と `docs/design/`
4. `docs/requirements/`、適用可能な `docs/design/` の設計判断
5. 対象コード、テスト、fixture、`Cargo.toml` / `Cargo.lock`
6. Native header / binding、WASM定義、build script、対応する公開レビュー
7. Symbol / NEM の事実確認が必要な場合だけ `docs/knowledge/` と公式仕様・schema・SDK

`docs/design/` が設計・判断の現行正本である。設計判断と仕様に競合があれば、実装で補完せず未決定として扱う。

## 対象と変更範囲

- ユーザーが明示した crate、binding、ファイル、機能だけを対象にする。
- Core、Native C ABI、WASM binding、生成物 `pkg/` の責務を区別する。生成物を直接編集して正本にしない。
- 仕様、README、設計、テスト、fixtureを変更する必要がある場合は、依頼範囲と正本を確認する。レビュー成果物を作成・上書きしない。
- 新しい依存関係、公開API、設定、wire field、fallback、互換動作を、便利さや将来拡張だけを理由に追加しない。

## 実装前ゲート

コードを書く前に、対象仕様から次を確認する。

- 入力、出力、公開API、型、必須性、ownership、error code、warning
- Wallet Store / Pending Profile の opaque 契約、replacement Store、atomicity、version、resource limit
- validation、正規化、状態、重複、処理順序、失敗時の結果
- Mnemonic、private key、public key、signature、address、hash の表現・長さ・raw bytes / text 境界
- 署名対象 byte 列、canonical serialization、encoding、byte order、数量、Chain、Network
- 暗号化対象、AAD、nonce、salt、tag、KDF、乱数、認証失敗、zeroize、保持期間
- Native の borrowed input / owned output / free API と panic の境界
- WASM の `Uint8Array`、JavaScript object、初期化、runtime上の秘密情報制約
- unknown type / version / field、malformed、truncated、duplicate、wrong chain / network の扱い
- 固定ベクタ、fixture、適合試験、実行すべき検証

外部可視動作や安全性に影響する事項が根拠なく決められない場合は、実装を続けず `docs/reviews/implementation/implement-spec-feedback.md` へ仕様フィードバックとして分離する。内部実装の選択だけなら、外部動作を変えない範囲で選び、不要な公開抽象化を追加しない。

## 実装上の規則

### 仕様適合

- 仕様の必須、禁止、任意を区別してコードへ反映する。
- 外部入力を使用前に検証し、検証済みの型だけを下流へ渡す。
- 正常系、異常系、境界、状態、error、replacement Store の結果を仕様どおりに実装する。
- 入力 Store を直接変更せず、仕様が定める成功時の完全な replacement と失敗時の未変更条件を守る。
- Rust Core の結果と error code を、Native / WASM binding で勝手に変換・拡張しない。
- 署名、保存、export、削除を認証・検証・対象一致の前に実行しない。

### セキュリティ

- 秘密鍵、Mnemonic、Profile password、導出鍵、平文 Store、復号データをログ、panic、error、warning、debug出力へ出さない。
- 秘密情報の不要なコピーを増やさず、Core が所有する一時値を仕様と既存の `zeroize` 方針に従って破棄する。
- 暗号学的乱数を使い、固定 nonce / salt、予測可能な乱数、認証前の復号結果を本番処理に使わない。
- 定数時間比較、認証タグ、AAD、失敗時の fail-closed は仕様と適用設計に従う。一般論だけで外部動作を拡張しない。
- 認証失敗、改ざん、破損、wrong chain / network、invalid length では処理と状態変更を継続しない。

### Symbol / NEM

- Symbol と NEM、Mainnet と Testnet を暗黙に共通化しない。
- `symbol-sdk` 3.3.2 は要件で定めた互換性基準であり、SDKの利便APIの挙動だけを protocol 仕様とみなさない。
- public key、private key、signature、hash、address の長さと表現、raw bytes と hex / text を確認する。
- HD導出、署名対象、address生成、network値、byte order は仕様、`docs/knowledge/`、公式資料、固定fixtureへ追跡する。
- ブロックチェーン数量の計算に浮動小数を使わない。

### Native / WASM binding

- binding は buffer、ID、enum、DTO、warning、安定 error code、ownership の変換に限定し、鍵管理・暗号・導出・署名意味判断を複製しない。
- Native の入力は借用、出力は対応する `snwc_free_*` で解放する契約を守る。free関数で arbitrary pointer を安全化したと仮定しない。
- C ABI の panic を境界外へ漏らさず、エラー時に caller-owned output を壊さず、途中生成した owned buffer を解放する。
- WASM の `Uint8Array` と JavaScript 側のコピーが自動 zeroize されるとは扱わない。公開範囲と秘密情報 export を仕様どおりに保つ。

## テスト方針

対象仕様に応じ、次の分類から必要なテストを追加・更新する。

- 正常、最小、境界、Mainnet / Testnet、Symbol / NEM、deterministic output
- malformed、truncated、invalid length、resource limit、duplicate、unknown version / enum / field
- wrong password、wrong chain / network、invalid mnemonic / private key、tampered store、invalid tag
- atomicity、重複登録、password change、削除、export、replacement Store、再利用禁止
- Native header compile、C ABI runtime、owned buffer の解放、WASM API と `Uint8Array`
- 署名 byte 列、address、公開鍵、HD導出の独立した fixed vector / interop fixture

期待値を実装ロジックの単純な複製で生成しない。fixtureの出典を記録し、秘密値をテスト出力や fixture に含めない。coverageの任意の数値目標を新設しない。

## 実装手順と検証

1. 対象、仕様、変更境界、既存ユーザー変更を確認する。
2. 仕様から外部可視動作と検証条件を抽出する。
3. 実装前ゲートで不足・矛盾・未決定事項を分類する。
4. 必要なら仕様フィードバックを作成し、決定前の外部動作を実装しない。
5. Core、binding、テスト、fixtureの責務を確認して最小変更を実装する。
6. 仕様に対応する正常系・異常系・境界テストを追加・更新する。
7. ルート `AGENTS.md` の `Change-aware validation` に従い、実際の変更分類と明示された
   依頼範囲に該当する formatter、clippy、test、WASM、Native 検証だけを実行する。
8. 未実行の検証、未確認の protocol 事実、残存リスク、仕様フィードバックを報告する。

docs-only または agent / skill-only の作業では、コード、manifest、dependency、build
configuration、test、fixture に変更がない限り、Rust / WASM / Native / Node の実装テストを
実行しない。Rust Core、WASM、Native C ABI、Node-API / npm に影響する変更がある場合の
具体的なコマンド、対象外の扱い、未実行理由の報告は `AGENTS.md` の分類に従う。環境に
target や外部ツールがない場合は未実行理由を明記する。

Native C ABI の変更時は、`AGENTS.md` の分類に従って `bindings/native/tests/run_c_abi_runtime.sh`、
header compile、必要な sanitizer を追加確認する。WASM生成物を更新する場合は
`scripts/build-wasm.sh` の実行結果と生成先を分けて記録する。

## 自己確認

- 変更した外部可視動作が承認済み仕様へ追跡できる。
- Core / Native / WASM の責務、ownership、error、秘密情報境界を守っている。
- Symbol / NEM、Mainnet / Testnet、SDK / protocol、raw bytes / text を混同していない。
- Wallet Store / Pending Profile の opaque 契約、atomicity、replacement を守っている。
- 仕様にない機能、API、field、error、fallback、将来拡張を追加していない。
- 正常系だけでなく該当する異常系・境界・相互運用性を検証している。
- 秘密情報がコード、ログ、panic、error、warning、fixture、test outputへ出ていない。
- 実行した検証と未検証範囲を区別して報告できる。

## 作業完了後の Git 運用

`../author-common/author-playbook.md` の「完了と Git」を適用する。
