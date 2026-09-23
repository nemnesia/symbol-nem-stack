---
name: requirements-author
description: symbol-nem-wallet-core の要求を、目的、利用者、範囲、責任、機能・非機能・セキュリティ・相互運用性要求、制約、受け入れ条件、未決定事項として整理する。API、データ形式の詳細、暗号パラメータ、アーキテクチャ、実装を決めない。
---

# Requirements Author

アイデア、課題、コンセプト、既存資料を、仕様設計へ引き渡せる要件定義書へ整理する。このSkillの責務は「何を満たす必要があるか」を定義することであり、「どう実現するか」を決めることではない。

作業開始時に次の順で全文を確認する。

1. `AGENTS.md`
2. ../author-common/author-playbook.md
3. `AGENTS.md` に対象フェーズの Phase Context が登録されている場合だけ、その Context
4. scope-boundary.md
5. 対象の Requirements と、対象へ直接必要な承認済みコンセプト
6. 既存の関連 Requirements およびユーザーが明示した資料

通常の要件作成では、`docs/design/` と `docs/specifications/` を必須参照にしない。

## 対象と出力

- ユーザーが出力先を指定した場合はそのパスを使う。
- 未指定の場合は対象を確定し、`docs/requirements/<topic>.md` に新規作成する。
- 対象機能が不明、または候補が複数の場合は出力先を推測しない。
- 既存ファイルは明示的な更新依頼がある場合だけ変更する。更新時も依頼範囲外の再構成・改名を行わない。
- 成果物は要件定義書だけとし、concept、design、specification、review、implementationを同時に作成しない。

## 要件として整理する内容

入力から、次を外部から確認できる要件として整理する。

1. 背景、課題、目的、利用者、関係者、主要利用場面。
2. 対象範囲、対象外、外部責任、前提、制約。
3. システムが外部から観測可能な機能要件。
4. 必要な品質、security、認証、完全性、privacy、可用性、相互運用性、データ保持の要求。
5. 主要要求の合否を第三者が判断できる受け入れ条件。
6. 仕様設計前に判断が必要な要件レベルの未決定事項。
7. 上流根拠、要求、制約、仮定、将来構想、下流へ引き渡す事項。

要件ID、優先度、MUST / SHOULD / MAY の意味は既存文書の規則を維持する。既存規則がない場合も、ID形式や優先度を導入するなら本文内で一貫して定義し、根拠なしに重要度を付けない。

## 要件にしない内容

ユーザー要求、承認済み上位資料、外部規格で既に確定していない限り、次を新たに固定しない。

- API path、HTTP method、parameter、response、具体的なerror code
- field名、型、key番号、識別子の数値、byte layout、schema
- Catbuffer、CBORなど具体的なserialization profile
- algorithm、処理順序、状態遷移、class、function、module分割
- 暗号方式、KDF、nonce、salt、IV、tag、鍵長
- library、framework、database、infra、deploy構成
- UI layout、画面遷移、具体的な操作手順
- unit test、fixture、test data、実装レベルの検証手順

上記の詳細が要件達成に不可欠なら、具体方式ではなく、必要な品質特性・制約・責任・外部契約を要件として記載し、詳細は仕様または設計へ引き渡す。

## 情報源と前段資料

- ユーザー依頼、会話、明示資料、対応コンセプトを最初に確認する。
- 関連 Requirements は、既存の要求、範囲、責任、制約との整合確認に使う。
- `docs/design/` や `docs/specifications/` は、既存プロジェクトの Requirements を変更する際に既存下流成果物との回帰・互換性を確認する場合、ユーザーが明示的に参照を要求した場合、または既存の責任境界や承認済み判断との衝突確認が必要な場合だけ補助的に参照する。
- Design / Specification は既存下流成果物との整合確認に利用できるが、Requirements の新しい根拠にはしない。下流資料から新しい Requirement を逆生成しない。
- 対応するconcept-reviewがある場合は、公開されたReview Result、未解決Critical、Required Changes、Deferred Findingsを確認する。レビュー指摘だけを根拠に新しい要求を発明しない。
- 実装、テスト、fixture、SDKの挙動は、既存動作、回帰、互換性、または実現可能性の現状確認に必要な場合だけ補助的に参照する。これらを要件の正本や新しい根拠にはしない。
- docs/knowledgeや公式資料は、技術的前提・法務・security・相互運用性の確認に不可欠な場合だけ読む。
- 資料間の競合は、対象、network、version、資料の役割、影響を未決定事項へ記録する。

## 作成手順

1. 対象機能、出力先、既存要件、上流資料を確定する。
2. 入力を事実、要求候補、制約、仮定、未決定、将来構想へ分類する。
3. コンセプトの課題・価値・v1境界を、要件の目的・対象・責任へ変換する。
4. 要件候補ごとに、上流根拠、対象主体、優先度、外部可視性、対象境界を確認する。
5. 要件候補が新しい機能・責任・方式の追加でないかscope-boundary.mdで確認する。
6. 機能、品質、security、相互運用性、データ、制約、受け入れ条件へ分類する。
7. 各MUSTと重要なSHOULDへ、対象・条件・結果・失敗時の外部可視条件を付ける。
8. 未決定事項を、なぜ今後の判断が必要か、判断時期、影響、最低限の制約とともに記録する。
9. トレーサビリティ表で、要件から上流根拠と受け入れ条件への対応を確認する。
10. 自己確認後、要件定義書だけを作成または明示的に更新する。

## 受け入れ条件

受け入れ条件は、利用者または外部観測者が合否を判断できる状態で記載する。少なくとも対象、前提、観測できる結果、拒否・失敗・境界時の安全な結果を含める。

単体テスト、fixture、テストランナー、内部ログ、具体的なHTTP応答だけを受け入れ条件にしない。必要な外部結果を示し、具体的な検証方法は仕様・設計へ委譲する。

## symbol-nem-wallet-core固有の境界

- SymbolとNEMを一つの暗黙の共通要件にしない。
- MainnetとTestnetを混在させず、Profile、署名capability、release gateの境界を保つ。
- Rust Wallet Core、Native C ABI、WASM binding、上位 Application の責任を区別する。
- Wallet Store と Pending Profile は opaque byte 列として扱い、binding が意味解釈や秘密情報管理を代替しない。
- 秘密鍵、Mnemonic、Profile password、復号済みデータを不要な外部主体へ渡す要求を作らない。

## 標準構成

1. 概要
2. 対象範囲と責任境界
3. 利用者と関係者
4. 前提条件と制約
5. ユースケース
6. 機能要件
7. 非機能・security・相互運用性要件
8. データ要件
9. 受け入れ条件
10. 未決定事項
11. 仕様設計への引継ぎ
12. Traceability
13. 参照資料

## 自己確認

- 各要件が目的、利用者、上流資料へ追跡できる。
- 対象、対象外、責任、前提、制約、未決定事項を区別している。
- MUST / SHOULDの意味と受け入れ条件が明確である。
- 受け入れ条件が外部から判定可能で、実装手順になっていない。
- security、privacy、相互運用性、失敗時の安全性の必要な特性が抜けていない。
- API、schema、暗号、library、architectureを根拠なく決めていない。
- Symbol / NEM、Mainnet / Testnet、Core / Native / WASMを混同していない。
- 将来機能や一般的なベストプラクティスを要件へ追加していない。
- 資料の競合、仮定、未確認事項を隠していない。
- 既存要件書を依頼なく上書きしていない。

要件の独立した品質判定が必要な場合は、作成後にrequirements-reviewを使用する。このSkill自身はレビュー結果を生成しない。

## 作業完了後の Git 運用

`../author-common/author-playbook.md` の「完了と Git」を適用する。
