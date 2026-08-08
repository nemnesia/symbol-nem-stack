# Specification Review Findings

## Review Target

- 対象: `packages/symbol-nem-interchange-format/doc/spec-api.md`
- 確認日: 2026-08-08 21:45

## Evidence Used

| 種別 | 参照箇所 | 用途 |
| --- | --- | --- |
| 仕様本文 | `packages/symbol-nem-interchange-format/doc/spec-api.md` 1〜8章、9〜15章、18〜28章 | APIの責任範囲、公開型、エラー、provider、復号処理、適合テストおよび実行環境の確認 |
| 仕様本文 | `packages/symbol-nem-interchange-format/doc/spec-format.md` 5.5.2、6.2〜6.3、7.1、9.4〜9.5 | APIが引き継ぐ署名関連byte列、標準暗号プロファイル、復号後payload検証およびfixture判定の確認。フォーマット仕様自体は今回のレビュー対象外 |
| コンセプト本文 | `packages/symbol-nem-interchange-format/doc/concept-sheet.md` 「v1のスコープと責任境界」67〜104行 | APIの対象範囲と対象外の整合性確認 |
| コンセプトレビュー結果 | `packages/symbol-nem-interchange-format/doc/reviews/concept-sheet-review-findings.md` Review Result、Required Changes、Review Gates | 前段レビューの判定と未解決ブロッカーの確認 |
| 要件本文 | `packages/symbol-nem-interchange-format/doc/requirements.md` FMT-001〜FMT-014、LIB-001〜LIB-003、SEC-001〜SEC-004、AC-001〜AC-011 | APIへの引継ぎ要件、責任境界、秘密情報保護および受け入れ条件の確認 |
| 要件レビュー結果 | `packages/symbol-nem-interchange-format/doc/reviews/requirements-review-findings.md` Review Result、Required Changes、Review Gates | 仕様設計へ進める判定と未解決ブロッカーの確認 |

## Review Result

実装へ進める

## Summary

APIの目的、対象範囲、標準7type、custom type、保護済みpayloadおよび形式検証の責任境界は一意に理解できる。
前回確認した署名関連hex検証と条件付き禁止フィールドのerror codeは、現行本文と適合テストへ反映されている。
`parse`、`validate`、`serialize`、`protect`、`unprotect` の主要な正常系・拒否系と、標準暗号providerの条件は上流要件と整合する。
providerの失敗結果の公開方法と、復号後の構文エラーの分類には、既存の秘密情報保護・復号後検証要件に対する明確化事項が残る。
実装開始を妨げるCriticalは確認されない。

## Required Changes

### SR-001

- Priority: Major
- 対象箇所: `spec-api.md` 8章（378〜448行）、13章（566〜598行）、14〜15章（600〜650行）、20章（701〜707行）
- 問題: `ProtectionProvider.validate`、`protect`、`unprotect` は `SnifResult` を返すため、providerが失敗時に `SnifError` を返す経路がある。一方、仕様が明示的に公開禁止としているのはproviderの例外 `message/cause` のコピーであり、providerが返した `SnifError.message`、`path`、`code` をコアAPIがそのまま公開できるか、どのように安全な公開errorへ変換するかが定義されていない。
- 根拠: 仕様本文 `spec-api.md` 8章、13章、14〜15章、20章。要件本文 LIB-003、SEC-003。
- 影響: providerが返す失敗結果をコアが透過すると、秘密情報やprovider固有の診断情報を含むerrorが公開され、秘密情報をエラー等へ含めない要件を満たせない実装が成立する。providerごとに公開されるerror code、path、messageの扱いも分岐する。
- 修正内容: providerが返す失敗結果についても、コアAPIの公開 `SnifError` が秘密情報、入力値、providerのmessage/causeを含まないこと、および公開可能なcode/pathへの変換規則を明示する。provider例外の扱いとの違いも同じ責任境界で定義する。
- 修正完了条件: `validate`、`protect`、`unprotect` のprovider失敗結果およびprovider例外について、外部へ返るerrorが安全なmessage、定義済みcode/pathとなり、秘密情報を含まないことを独立して判定できる。

## Optional Improvements

### SR-002

- Priority: Minor
- 対象箇所: `spec-api.md` 8章（427〜448行）、15章（638〜650行）、24章（767〜770行）
- 改善内容: `unprotect` の復号byte列について、UTF-8 decode失敗またはJSON構文解析失敗時の公開error codeと `path` を明記する。現行の `DECRYPTED_PAYLOAD_INVALID` は「JSONとして解釈できてもpayload構造が不正」と定義されており、復号後の構文エラーを含むかが判断できない。
- 根拠: 仕様本文 `spec-api.md` 8章、15章、24章。仕様本文 `spec-format.md` 6.3（552〜559行）。要件本文 AC-004、AC-006。
- 影響: 認証成功後の不正なUTF-8またはJSONについて、`INVALID_JSON`、`PROTECTION_FAILED`、`DECRYPTED_PAYLOAD_INVALID` のいずれを返すかが実装ごとに分かれ、復号失敗の適合テストと利用側のエラー処理が一致しない。

### SR-003

- Priority: Minor
- 対象箇所: `spec-api.md` 8章（427〜448行）、8.1（450〜475行）、9〜10章（477〜542行）
- 改善内容: 必須フィールドである `version` が欠落した場合の公開error codeと `path` を明記する。現行では `UNSUPPORTED_VERSION` が「対応versionではない」、`MISSING_REQUIRED_FIELD` が通常の必須フィールド欠落と定義され、検証順序も `version` を共通必須フィールドより先に扱うため、欠落時の分類が一意でない。
- 根拠: 仕様本文 `spec-api.md` 5章、8章、8.1、9〜10章。仕様本文 `spec-format.md` 3.1（62行）。要件本文 FMT-003、AC-006。
- 影響: version欠落を `UNSUPPORTED_VERSION` とする実装と `MISSING_REQUIRED_FIELD` とする実装が成立し、公開APIのエラー処理および適合テストの期待結果が一致しない。

## Review Gates

| Gate | 結果 | 根拠 |
| --- | --- | --- |
| 目的と範囲 | 合格 | `spec-api.md` 1〜3章で、ライブラリAPIの対象と搬送・UI・意味検証等の対象外が定義されている。 |
| 機能と制約 | 合格 | `spec-api.md` 4〜7章、14〜15章、23章、27章で、標準7type、custom type、保護状態、公開APIおよび標準providerの条件を確認できる。 |
| 処理と例外 | 合格 | `spec-api.md` 8.1、9〜15章、20〜21章で、検証順序、正常処理、暗号処理、エラー、例外変換および非同期性を確認できる。SR-001〜SR-003は公開結果の明確化であり、主要処理の実装開始を妨げない。 |
| 内部整合性 | 合格 | 共通エンベロープ、標準type、`payload` / `protectedPayload` の排他、署名要求・応答およびprovider境界は本文内で整合している。 |
| 検証可能性 | 合格 | `spec-api.md` 24章と上流フォーマット仕様の正常・拒否・暗号fixtureにより、現行スコープの主要条件を検証できる。SR-002〜SR-003はerror分類の明確化事項であり、受理・拒否自体の判定を妨げない。 |
| 不可欠な前提の現実性と安全性 | 合格 | `spec-api.md` 13、16〜17、20、26〜27章および要件本文 SEC-001〜SEC-004、LIB-003で、provider境界、処理資源、秘密情報および対応実行環境の前提を確認できる。SR-001は実装・運用上のMajorであり、品質ゲートを不合格にするCriticalではない。 |
| コンセプト・要件定義との整合性と前段品質判定 | 合格 | コンセプトレビュー結果は「要件定義へ進める」、要件レビュー結果は「仕様設計へ進める」であり、目的、スコープ、責任境界および要件がAPI仕様へ引き継がれている。 |

## Final Decision

実装へ進める。

現行API仕様は、承認済みのフォーマット要件を実装・検証できる品質に達している。
SR-001は実装・運用上の修正推奨、SR-002〜SR-003は公開エラー契約の明確化であり、いずれも実装開始を妨げるCriticalではない。
