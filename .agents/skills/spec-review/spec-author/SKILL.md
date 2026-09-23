---
name: spec-author
description: symbol-nem-wallet-core の承認済み要求・設計を、実装・検証可能な外部仕様へ具体化する。API契約、データ形式、validation、error、security、相互運用規則を定めるが、新しい要求や将来機能は発明しない。
---

# Specification Author

承認済み要求と基本設計を、実装者・利用者・別実装が同じ結果を得られる外部仕様へ具体化する。このSkillの責務は「外部から何が観測でき、どの入力をどう扱い、どの条件で成功・失敗するか」を定義することであり、要求や内部実装を新規に作ることではない。

作業開始時に次の順で全文を確認する。

1. `AGENTS.md`
2. ../author-common/author-playbook.md
3. `AGENTS.md` に対象フェーズの Phase Context が登録されている場合だけ、その Context
4. 対象の Specification と関連仕様
5. `docs/design/` の対象設計と設計判断、および対象へ直接必要な承認済み requirements
6. `docs/knowledge/` の対象技術資料と必要な公式資料
7. 既存の実装、公開API、テスト、fixture（既存契約との互換性、実現可能性、回帰またはfixtureの照合に必要な場合だけ）
8. 対象の公開レビュー結果と実装者フィードバック（対象一致する既存フィードバックの確認またはユーザーが明示した場合だけ）

## 対象と出力

- ユーザーが対象、出力先、更新範囲を指定した場合はそれを優先する。
- 未指定の場合は対象機能を確定し、`docs/specifications/<topic>.md` に新規作成する。
- 対象が不明、複数の責務にまたがる、または候補が複数の場合は推測で選ばない。
- 既存仕様書は明示的な更新依頼がある場合だけ変更する。現行正本の移動・改名・上書きをしない。
- 成果物は仕様書だけとし、requirements、design、implementation、test、reviewを同時に作成しない。

## 仕様の責務

対象に必要な範囲で、次を外部から判定できる粒度で定める。

- 適用範囲、対象外、用語、前提、責任境界、capability
- 入力、出力、公開API、データ形式、field、型、必須性、制約
- validation、正規化、処理順序、状態、lifecycle、error、禁止事項
- 決定的serialization、encoding、byte列、数量、日時、version、互換性
- security、認証、完全性、replay、期限、サイズ、秘密情報、失敗時の安全側動作
- Symbol / NEM、Mainnet / Testnet、transaction / message、署名対象の差異
- Rust Core、Native C ABI、WASM binding、上位 Application、外部 node の責任境界
- 受け入れ条件、固定vector、fixtureの出典、実装・適合テストへの引継ぎ

外部契約を定める場合も、既存要求・`docs/design/`・公式protocol仕様への根拠を付ける。根拠のない初期値、ID、version、サイズ、暗号パラメータを推測しない。

## 仕様にしない内容

- 上位要求にない機能、API、設定、field、error、fallback、互換動作
- 内部class、function、module、package分割、DB実装、library、framework、infra
- UI layout、実装者の好み、将来の拡張点、未要求の運用機能
- SDKの便利APIや既存コードの挙動だけを根拠とするprotocol規則
- binding が opaque と扱う Wallet Store / Pending Profile の意味解析や改変

方式が複数あり選択が必要な場合は、採用判断の根拠が承認されているか確認する。判断できなければ未決定事項として残し、実装できるように見せるための暫定値を入れない。

## 上流資料とレビュー結果

- requirementsの各要求を仕様の章・契約・受け入れ条件へ追跡する。
- designの責務、依存方向、trust boundary、主要フローを外部契約へ適用するが、内部設計をwire仕様へ混ぜない。
- concept、requirements、designの公開レビュー結果がある場合、Review Result、未解決Critical、Deferred、対象一致を確認する。
- 実装者からの仕様フィードバックがある場合、仕様の欠落・矛盾・実装不能性を確認し、採用・保留・却下の根拠を記録する。実装フィードバックだけで新機能を追加しない。
- 過去レビューの指摘をそのまま仕様にコピーせず、上流根拠と今回の対象へ再追跡する。

## 作成手順

1. 対象仕様、対象、出力先、更新可否を確定する。
2. 承認済みrequirements、design、関連仕様を抽出し、要求IDとの対応表を作る。
3. 実装・テスト・fixture・公式資料を、既存契約と技術的事実の照合に必要な範囲だけ確認する。
4. 対象外、用語、主体、trust boundary、責任を先に固定する。
5. 正常系の入力、出力、処理、状態、結果を定義する。
6. malformed、境界、認証失敗、改ざん、truncated、duplicate、unknown version / type、wrong chain / network、timeoutなど該当する異常系を定義する。
7. API、schema、encoding、serialization、署名、暗号、error、互換性を、根拠のある範囲で具体化する。
8. Symbol / NEMとMainnet / Testnetの差異をchain-specificに分離する。
9. 受け入れ条件、適合試験、fixed vector、fixture、未決定事項を整理する。
10. 仕様の各契約が実装者の推測なしで判定可能か、上流要求へ戻って自己確認する。
11. 自己確認後、仕様書だけを作成または明示的に更新する。

## 標準構成

1. 概要と適用範囲
2. 対象外、用語、責任境界
3. 設計原則と前提
4. 公開APIまたは外部契約
5. データモデルとfield制約
6. encoding / serialization / byte規則
7. 正常系処理と状態
8. validation、error、禁止事項
9. security、認証、完全性、replay、秘密情報
10. chain / network / version / compatibility
11. サイズ・resource・lifecycle制約
12. 受け入れ条件と適合試験
13. 未決定事項と下流引継ぎ
14. Traceabilityと参照資料

対象に該当しない章は省略してよいが、必要な契約を「実装で決める」とだけして外部仕様を空白にしない。

## symbol-nem-wallet-core固有の安全規則

- `symbol-sdk` 3.3.2 は互換性検証の基準であり、SDK APIそのものをprotocol仕様と同一視しない。
- Symbol / NEM、Mainnet / Testnet、通常 / embedded / aggregate、signer / cosignerの差異は、対象仕様にある場合だけ明示する。
- quantityを浮動小数で定義・計算しない。hex、raw bytes、public key、private key、signature、hashの表現と長さを確認する。
- 署名対象byte列、canonical serialization、network constant、address規則は承認済み仕様または公式資料へ追跡する。
- Wallet Store と Pending Profile は仕様が定める opaque 境界を守り、bindingへ意味解析を移さない。
- Rust Coreが正本とする鍵管理、Wallet Store、秘密情報処理、raw signingをNative / WASM bindingへ再実装しない。
- 秘密鍵、Mnemonic、password、credential、復号データを仕様例やfixtureへ書かない。

## 未決定事項

未決定事項には、ID、論点、なぜ現時点で決められないか、影響する外部契約、判断者または判断段階、下限となる安全条件を記録する。未決定事項を隠して仮定を仕様の規範として扱わない。既存要求を満たすために不可欠な事項が未決定なら、仕様を実装開始可能と判定しない。

## 自己確認

- すべての仕様契約がrequirements、design、公式資料へ追跡できる。
- 入力、出力、必須性、validation、error、状態、禁止事項、versionが一意である。
- 正常系だけでなく該当する異常系、境界、改ざん、replay、認証失敗を定義している。
- 署名対象、byte列、encoding、数量、chain、networkが別実装で一致する。
- security、秘密情報、Core / Native / WASM binding境界を弱めていない。
- APIや暗号方式を根拠なく発明していない。
- 未知値、未対応、解析不能、結果不明を成功として扱っていない。
- 受け入れ条件と適合試験が、仕様の外部契約を検証できる。
- レビュー指摘や実装フィードバックを新しい要求へ無断変換していない。
- 未決定事項、競合、未確認資料を明示している。

仕様の独立した品質判定が必要な場合は、作成後にspec-reviewを使用する。このSkill自身はレビュー成果物を生成しない。

## 作業完了後の Git 運用

`../author-common/author-playbook.md` の「完了と Git」を適用する。
