# Implementation Review Findings

## Review Target

- 対象: `packages/symbol-nem-interchange-format/src/`、`packages/symbol-nem-interchange-format/test/snif.test.ts`、パッケージ設定
- 確認日: 2026-08-08 23:36 +0900
- レビュー範囲: SNIF v1の形式検証、標準暗号provider、protect/unprotect、公開エラー変換、対象パッケージのテストおよびビルド設定
- 未確認範囲: Node.js以外の正式対象環境での実行、仕様fixture全件との機械的な自動照合、外部実装との追加相互運用試験

## Evidence Used

| 種別                                   | 参照箇所                                                                                       | 用途                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 実装コードまたは差分                   | `packages/symbol-nem-interchange-format/src/validation.ts:22-77, 258-333`                      | JavaScript値モデル、共通エンベロープ、標準typeおよびprotectedPayloadの検証 |
| 実装コードまたは差分                   | `packages/symbol-nem-interchange-format/src/index.ts:28-72, 125-231`                           | parse/validate/serialize/protect/unprotectの処理順序とエラー変換           |
| 実装コードまたは差分                   | `packages/symbol-nem-interchange-format/src/protection.ts:87-240`                              | Argon2id、AES-256-GCM、乱数、パラメータ検証およびメモリ消去                |
| テストまたは fixture                   | `packages/symbol-nem-interchange-format/test/snif.test.ts:15-1118`                             | 正常・拒否fixture、形式境界、provider失敗、暗号処理および復号後失敗の検証  |
| 承認済み仕様                           | `packages/symbol-nem-interchange-format/doc/spec-api.md:522-556, 629-702, 771-806`             | JSON値モデル、provider境界、protect/unprotectおよび適合テスト観点          |
| 承認済み仕様                           | `packages/symbol-nem-interchange-format/doc/spec-format.md:31-41, 552-561, 617-639, 1318-1524` | byte列表現、復号後検証、fixture行列および標準暗号fixture                   |
| ユーザー提供資料またはプロジェクト資料 | `AGENTS.md:19-89`                                                                              | 情報源の区分、秘密情報保護、検証結果の報告方針                             |

## Review Result

公開可能

## Summary

標準7type、custom type、payload排他、transaction/connectionの条件付きフィールド、provider失敗変換および標準暗号providerの主要実装は、承認済み仕様と整合している。
配列の追加プロパティをJSON値モデル外として拒否する修正、不正UTF-8/JSON、provider失敗分類、資源制限および仕様fixture行列の主要テストも追加されている。
カバレッジは全体で90%基準を満たし、テスト37件、typecheck、lint、format、buildが成功した。
仕様の固定mnemonic暗号fixtureを標準providerの復号テストとして直接実行するケースは確認できず、残存する検証上の不足として記録する。
Criticalはなく、品質ゲートはすべて合格と判定する。

## Required Changes

### IR-001

- Priority: Major
- 対象箇所: `packages/symbol-nem-interchange-format/test/snif.test.ts:286-370, 757-1118`
- 問題: 仕様が定義する実装間適合テストのうち、標準暗号の固定mnemonic fixture（`spec-format.md` 9.5）を標準providerで復号するテストがなく、mnemonicについては乱数を使うprotect/unprotect往復だけである。さらに、仕様の「標準7typeの正常なparse / validate / serialize」は、`validValues`でvalidateのみを確認し、追加fixtureのparse/serializeは標準7type全件ではない。
- 根拠: 承認済み仕様 `spec-api.md:771-805` は標準7typeのparse/validate/serializeとaccount/mnemonicの標準provider相互運用性を適合テスト観点として定義する。`spec-format.md:631-639, 1318-1435` はaccount/mnemonic双方の固定暗号fixtureを定義する。現行テスト `snif.test.ts:286-370` のparse/serialize fixtureはsubsetであり、`snif.test.ts:805-1065` の固定暗号復号はaccountのみである。
- 発生条件: mnemonicのplaintext JSON表現、Argon2id入力、AES-GCM結合または復号経路に回帰が入っても、現行テストの乱数往復では同じ実装同士の整合しか確認できない。また、標準typeのparse/serialize処理が一部壊れても、validateの正常系テストだけでは検出できない。
- 影響: 別実装・別環境とのmnemonic相互運用性、および標準7typeのparse/serialize退行を対象パッケージの自動検証で独立に検出できない。
- 修正内容: 承認済み仕様の固定mnemonic暗号fixtureを標準providerの復号テストへ追加し、標準7typeについてparse、validate、serializeの受理結果を独立した期待値で確認する。
- 修正完了条件: `spec-format.md` 9.5のmnemonic `protectedEnvelope` が固定passwordで期待payloadへ復元され、標準7typeの各正常fixtureでparse/validate/serializeが仕様どおり成功する。
- 追加テスト: `crypto-mnemonic-aes256gcm-argon2id-001` の復号、標準7type各1件以上のparse/validate/serialize、connection-responseのapproved/rejected双方を含める。

## Optional Improvements

なし

## Specification Conformance

- 適合している要件: JSON値モデル、配列追加プロパティ拒否、共通エンベロープ、network非空、hex表現、標準7type/custom type、payload排他、transactionの`sign`/`sign-response`条件、connection-responseのstatus条件、標準AES-256-GCM + Argon2id、AADなし、復号後payload検証、provider失敗のallowlist変換、秘密情報を公開エラーへ含めないこと。主な確認箇所は`src/validation.ts:22-77, 167-333`、`src/index.ts:125-231`、`src/protection.ts:87-240`。
- 不適合の要件: なし
- 実装されていない要件: 固定mnemonic暗号fixtureおよび標準7type全件のparse/validate/serializeを独立検証するテスト（IR-001）。実装本体の不適合は確認されない。
- 仕様が曖昧で判定できない要件: なし

## Test Evaluation

- 十分に検証されている範囲: `snif.test.ts:15-284`の形式・JSON値モデル・配列追加プロパティ、`snif.test.ts:286-488`の正常/拒否fixture行列、`snif.test.ts:490-754`の型・必須性・protectedPayload境界、`snif.test.ts:805-1118`の標準account暗号fixture、認証失敗、復号後UTF-8/JSON不正、provider失敗変換、資源制限および例外。
- カバレッジ: V8実測値はstatements 95.02%、branches 91.00%、functions 97.43%、lines 95.55%。全体の90%閾値を満たす。ファイル別では`protection.ts`のbranchが77.96%で、標準providerの一部低境界・例外分岐が未実行だが、閾値不合格ではない。
- 不足しているテスト: 固定mnemonic暗号fixture、標準7type全件のparse/validate/serializeの独立確認（IR-001）。
- fixtureまたは期待値の問題: 現行テストに実装ロジックを複製した暗号期待値は確認されない。account固定fixtureは仕様値と一致する。mnemonic固定fixtureは未実行（IR-001）。
- 実行されていない検証: Node.js以外の正式対象環境、仕様fixture全件との機械的な自動照合、外部実装との追加相互運用試験。

## Review Gates

| Gate                   | 結果 | 根拠                                                                                                                      |
| ---------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------- |
| 仕様適合性             | 合格 | 形式検証、暗号処理およびprovider境界の実装を確認。固定mnemonic fixtureのテスト不足はIR-001。                              |
| セキュリティ           | 合格 | 秘密情報を公開エラーへ含めず、乱数、KDF、認証失敗、復号後検証および資源制限を実装。                                       |
| 相互運用性とプロトコル | 合格 | account固定暗号fixture、AADなし、hex、KDF、nonce/tag条件を確認。mnemonic固定fixtureは未確認としてIR-001に記録。           |
| 処理と異常系           | 合格 | 形式拒否、provider失敗、認証失敗、復号後UTF-8/JSON不正、資源制限および例外を確認。                                        |
| テスト十分性           | 合格 | 全体カバレッジ閾値を満たし、主要な仕様分岐を検証。IR-001はMajorの追加検証不足であり、Critical相当の未検証は確認されない。 |
| 変更範囲内の品質       | 合格 | typecheck、lint、format、test、coverage、buildが成功し、配列JSON値検証の回帰テストも存在する。                            |

## Remaining Risks

Node.js以外の正式対象環境での実行可否、仕様fixture全件との機械的な照合、外部実装との相互運用性は未確認である。`protection.ts`には低境界・例外分岐の未実行範囲が残るが、標準providerの主要な失敗分類と資源制限は検証済みである。JavaScript実行環境で秘密情報の完全消去を保証できないという仕様上の前提が残る。

## Final Decision

公開可能

実装本体は承認済み仕様に適合し、全品質ゲートに合格している。IR-001は現在の相互運用・適合テスト範囲に関するMajorの追加検証要求であり、公開可否を妨げるCriticalではない。
