# Specification Review Findings

## Review Target

- 対象: `packages/symbol-nem-interchange-format/doc/spec.md`
- 確認日: 2026-08-06

## Evidence Used

| 種別 | 参照箇所 | 用途 |
| --- | --- | --- |
| 仕様本文 | `spec.md` 3〜4章、5〜10章、13〜15章 | JSON wire、保証単位、標準payload、暗号、API、エラー、fixtureおよび追跡を確認 |
| コンセプト本文 | `concept-sheet.md` 6〜8章、11〜12章 | JSON v1の責任境界、保証単位、未決定事項の引継ぎを確認 |
| コンセプトレビュー結果 | `reviews/concept-sheet-review-findings.md` Review Result、Required Changes、Review Gates | 対象一致、前段判定および未解決ブロッカーを確認 |
| 要件本文 | `requirements.md` FR-003〜FR-019、NFR-001〜NFR-008、AC-001〜AC-018、OPEN-001〜OPEN-010 | 標準タイプ、保証単位、要求応答、受入条件および対象環境との整合性を確認 |
| 要件レビュー結果 | `reviews/requirements-review-findings.md` RR-001〜RR-003、Review Result、Review Gates | 仕様設計へ申し送られた資源制限、保証単位、期限・replayの反映状況を確認 |
| 承認済み要件またはプロジェクト資料 | `docs/knowledge/symbol-openapi3.yml:538-548`、`docs/knowledge/nem-openapi3.yaml:164-170`、`packages/symbol-sdk/src/nem/Network.js:112-113` | チェーン固有の意味検証責任およびNEM network IDの表現を確認 |

## Review Result

仕様の修正を優先する

## Summary

JSON wire化、password bytes、permission順序、host-context分離など、前回レビューの主要な修正は仕様本文へ反映されている。
しかし、平文envelopeの完全性保証単位、要求と応答の型対応、Unicode規則、暗号化encodeの入力契約が一意に定まっていない。
objectの再帰mapと公開API型の対応、およびpermission検証のerror codeも、実装間で異なる解釈が成立する。
そのため、正常・拒否fixture、暗号処理、接続・署名・トランザクションの相互運用結果を独立して確定できない。
実装開始前にRequired Changesを仕様本文、API契約およびfixtureへ反映する必要がある。

## Required Changes

### SR-001

- Priority: Critical
- 対象箇所: `spec.md` 3.3 118〜129行、4.3〜4.4 181〜208行
- 問題: 平文payloadの `sha3-256` digestはcanonical payloadだけを対象とし、`chain`、`network`、`type` などの共通envelopeを対象にする規則がない。一方、要件では共通envelopeの完全性が必須であり、暗号化payloadだけはAADでpayload以外のenvelopeを認証するため、平文と暗号化で保証単位が異なる。形式上有効なenvelopeの変更を検出するのか、保証対象外とするのかが確定していない。
- 根拠: 仕様本文 3.3、4.3〜4.4。要件本文 8. データ要件、FR-007、AC-005。要件レビュー結果 RR-002。
- 影響: 同じpayloadでもネットワークやchain条件が別の有効値へ変更された入力を、同一データとして受理する実装と拒否する実装が成立する。共通envelopeの保証範囲とfixtureの期待結果を一意に判定できない。
- 修正内容: 共通envelope、公開payload、暗号化payload、送信者認証について、各保証単位と検証結果を明示する。平文envelopeの変更を検出する場合は認証対象を規定し、検出しない場合は要件・受入条件・fixture・追跡表の保証範囲を修正する。
- 修正完了条件: 有効な `chain`、`network`、`type`、payload各フィールドの変更について、SNIFが検出・拒否するか受理するかを仕様とfixtureから一意に判定できる。

### SR-002

- Priority: Critical
- 対象箇所: `spec.md` 5.5〜5.9 274〜362行、5.11 376〜378行、8章 510〜521行・548行、13章 627〜656行
- 問題: 標準typeには `transaction-request` があるが対応するresponse typeまたは `signing-response` との対応規則が定義されていない。`validateContext` は任意の `SnifDocument` の組を受け取れる一方、許可されるrequest/response typeの組、signingTypeの一致、transaction requestの応答、期限・replayをどの要求型へ適用するかを定めていない。fixtureもconnection以外の要求応答の検証条件を具体化していない。
- 根拠: 仕様本文 5.5〜5.9、5.11、8章、13章。要件本文 FR-018、FR-019、データ要件およびAC-010〜AC-014。要件レビュー結果 RR-003。
- 影響: transaction requestに応答を返す方法、signing requestへのresponseの対応、型違いのrequest/responseの拒否条件を実装者が独自に決めることになる。要求対応、期限、replayおよび署名対象のfixtureを相互運用できない。
- 修正内容: v1で許可するrequest/response typeの組と、各組で検証するrequestId、chain/network、signingType、権限、期限およびreplay条件を定義する。transaction requestにresponseを持たせない場合はその責任境界を明記し、要件・fixture・APIから応答前提を除く。各拒否条件の検証主体とerror codeも定める。
- 修正完了条件: v1の全要求型について、対応する応答型、検証入力、受理条件、拒否条件、検証主体および期待error codeを仕様とfixtureから追跡できる。

### SR-003

- Priority: Critical
- 対象箇所: `spec.md` 3.4 144〜156行、5.4 262〜272行、10章 587〜593行
- 問題: 共通文字列規則は空文字列を禁止しUnicode NFCを要求するが、`mnemonic` と `passphrase` はUnicode NFKDと定義され、`passphrase` は `Text(0..1024 bytes)` で空文字列を許容する表記になっている。NFCとNFKDのどちらを受信時に要求するか、送信時に正規化するか拒否するか、passphraseの空値を許可するかが一意でない。
- 根拠: 仕様本文 3.4、5.4、10章。要件本文 FR-005、FR-009、AC-003、AC-007。要件レビュー結果 RR-002に関連する相互運用性の要求。
- 影響: 同じmnemonicまたはpassphraseについて、実装ごとに受理・拒否、保存する文字列、暗号digestの入力が分岐する。Unicode fixtureと実装間の意味同値性を確定できない。
- 修正内容: mnemonicおよびpassphraseを共通NFC規則の例外とするか、NFKD入力を要求するかを明記し、encode/decodeそれぞれの正規化または拒否規則を定める。空passphraseの許可、上限および期待結果を明示し、NFC/NFKD・空値のfixtureを追加する。
- 修正完了条件: 各Unicode入力について、受信時の入力条件、正規化後の値、canonical JSON・暗号入力、拒否時のerror codeを一意に判定できる。

### SR-004

- Priority: Critical
- 対象箇所: `spec.md` 3.1・3.3 59〜90行・118〜129行、4.3 181〜193行、6.1 382〜412行、8章 486〜508行
- 問題: `SnifDocument` のpayloadは平文payload objectまたは暗号文 `HexString` を取り得る一方、`EncodeOptions.password` は別に指定され、document内の `options` も暗号方式を表す。encodeが平文documentから暗号化documentを構築するのか、既に暗号化されたdocumentを再wire化するのか、documentのoptionsとpasswordの不一致を拒否するのかが定義されていない。
- 根拠: 仕様本文 3.1・3.3、4.3、6.1、8章。要件本文 FR-008、FR-010、AC-006、AC-008。
- 影響: 同一API入力が平文、暗号化、二重暗号化、または不整合errorに分岐し、password-v1 fixture、復号結果および秘密情報の取り扱いが実装ごとに異なる。
- 修正内容: encodeの入力を平文documentに限定するか、wire相当の暗号化documentも受け付けるかを決定し、`document.options`、`EncodeOptions.password`、payload表現の組合せごとの受理・拒否・生成結果を定義する。既存decode結果の再encode方針とfixtureを追加する。
- 修正完了条件: passwordの有無、payload表現、optionsの各組合せについて、encodeの入力条件、生成されるwire、拒否条件およびerror codeを一意に判定できる。

### SR-005

- Priority: Major
- 対象箇所: `spec.md` 5.10 364〜374行、8章 455〜552行
- 問題: `ObjectValue` の再帰mapが `{ string: ObjectValue }` と記載されており、`string` が任意のkeyを表すのか文字通りのfield名なのか、keyの空文字・長さ・Unicode・制御文字規則が定義されていない。また、公開APIの `PayloadByType`、`Options`、`Network` 等は本文の擬似定義を参照するだけで、TypeScript APIとしての型対応と条件付き制約がまとまっていない。
- 根拠: 仕様本文 3.4、5.10、8章。要件本文 FR-003、FR-004、FR-005、NFR-006、NFR-007、AC-002、AC-017。
- 影響: objectの異なるkeyを受理する実装、literal `string` fieldだけを受理する実装、または異なる型情報を公開する実装が成立する。canonical JSON、resource limit、fixtureの期待documentを独立して再現できない。
- 修正内容: object mapの任意key表現、keyの文字列規則、重複key、要素数・深さ・byte値の適用単位を形式的に定義する。公開APIで参照する全型と、条件付き必須・byte長・chain/network制約のruntime validation対応を型定義または対応表で明示する。
- 修正完了条件: objectの全境界と公開APIの全参照型について、入力JSON、意味document、runtime拒否条件およびfixture期待結果を第三者が追跡できる。

### SR-006

- Priority: Major
- 対象箇所: `spec.md` 5.6〜5.7 301〜330行、9章 558〜574行、13章 623〜637行・656行
- 問題: 未知・重複・順序違反permissionはpayload schemaの不正である一方、`invalid-context` の発生条件表にもpermission不正が含まれている。後段ではpayload schema違反を `invalid-payload` と定めているが、connection fixtureは拒否条件を列挙するだけで、各caseの期待error codeを指定していない。
- 根拠: 仕様本文 5.6〜5.7、9章、13章。要件本文 FR-015、FR-016、AC-012、AC-013。
- 影響: permission配列の順序違反をdecode時に `invalid-payload` とする実装と `invalid-context` とする実装が成立する。適合fixtureおよび利用側のエラー処理が実装間で一致しない。
- 修正内容: payload内だけで判定できるpermissionの未知・重複・順序・account field不整合と、元requestを必要とするsubset・requestId・期限・replayを明確に分離する。各fixtureに検証主体と期待error codeを記録する。
- 修正完了条件: connectionの全正常・拒否caseについて、decodeまたは `validateContext` のどちらが判定し、どのerror codeを返すかを一意に判定できる。

## Optional Improvements

### SR-010

- Priority: Minor
- 対象箇所: `spec.md` 697〜714行
- 改善内容: 仕様本文が、上書き対象である現在の仕様レビュー成果物を「SR-001〜SR-006の入力」として参照し、直前のレビュー判定を事実として記録している。レビュー成果物を更新すると本文の対応状況と記載時点が不明確になるため、レビュー履歴は仕様本文から分離するか確認日・版を記録する。
- 根拠: 仕様本文 14章・15章、および本レビュー成果物。
- 影響: 後続レビューで、本文が参照する指摘ID・判定と現行レビュー結果の対応を誤認しやすい。

## Review Gates

| Gate | 結果 | 根拠 |
| --- | --- | --- |
| 目的と範囲 | 合格 | `spec.md` 1〜2章。JSON v1の対象範囲、対象外の搬送・意味検証、責任境界は理解できる。 |
| 機能と制約 | 不合格 | SR-001〜SR-005。完全性保証、要求応答、Unicode、暗号化encode、object/API型の契約が一意でない。 |
| 処理と例外 | 不合格 | SR-002〜SR-004、SR-006。要求応答の処理主体、正規化・暗号化入力、permissionエラー分類が確定していない。 |
| 内部整合性 | 不合格 | SR-001〜SR-004、SR-006。平文・暗号化の保証単位、NFC/NFKDと空値、document/options/password、payload/context error分類に相互の解釈分岐がある。 |
| 検証可能性 | 不合格 | SR-001〜SR-006。fixtureの対象、期待document、検証主体およびerror codeを全標準typeについて一意に再現できない。 |
| 不可欠な前提の現実性と安全性 | 不合格 | SR-001〜SR-004。envelope改変の保証範囲、要求対応、秘密payloadのencode経路、秘密情報の正規化が未確定である。 |
| コンセプト・要件定義との整合性と前段品質判定 | 不合格 | コンセプトレビューは「要件定義へ進める」、要件レビューは「仕様設計へ進める」だが、SR-001〜SR-004が要件レビュー結果RR-002/RR-003の仕様設計への申し送りを解消できていない。 |

## Final Decision

仕様の修正を優先する。
前回レビューの主要指摘は一部反映されているが、現在も完全性保証、要求応答、Unicodeおよび暗号化APIの境界に実装結果を分岐させる未確定事項が残っている。
Required Changesを仕様本文、公開API、エラー契約および適合fixtureへ反映し、各品質ゲートを再確認してから実装を開始する必要がある。
