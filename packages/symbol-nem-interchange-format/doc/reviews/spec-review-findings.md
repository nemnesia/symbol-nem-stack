# Specification Review Findings

## Review Target

- 対象: `packages/symbol-nem-interchange-format/doc/spec.md`
- 確認日: 2026-08-06

## Evidence Used

| 種別                               | 参照箇所                                                                                     | 用途                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 仕様本文                           | `spec.md` 3〜4章、5.7〜5.11、6〜13章                                                         | wire規則、標準payload、暗号、公開API、エラー、fixture、責任境界の確認        |
| コンセプト本文                     | `concept-sheet.md` 6〜8章、12章                                                              | v1スコープ、最小権限・最小開示、署名・text表現の引継ぎを確認                 |
| コンセプトレビュー結果             | `reviews/concept-sheet-review-findings.md` 19〜29行、39〜55行                                | 対象一致、前段判定、未解決Criticalの有無を確認                               |
| 要件本文                           | `requirements.md` 6〜11章                                                                    | FR-010、FR-011、FR-018、FR-019、AC-003、AC-008、AC-014、AC-017の引継ぎを確認 |
| 要件レビュー結果                   | `reviews/requirements-review-findings.md` 21〜53行、65〜82行                                 | RR-001/RR-002の対応状況と前段判定を確認                                      |
| 承認済み要件またはプロジェクト資料 | `docs/knowledge/nem-openapi3.yaml:164-170`、`packages/symbol-sdk/src/nem/Network.js:112-113` | NEM network IDの論理値とraw byteの区分を照合                                 |
| 承認済み要件またはプロジェクト資料 | `docs/knowledge/symbol-openapi3.yml:538-548`                                                 | transactionの意味・serializationをSNIF外へ委ねる責任境界を照合               |

## Review Result

仕様の修正を優先する

## Summary

目的、責任境界、秘密情報の平文・暗号化、text representation、接続の最小開示は明確に整理されている。
一方、connection-responseの権限配列、password入力、text正規性、署名表示情報の表現に、同じ論理入力から一意の結果を得られないまたは検証できない箇所が残っている。
公開APIの型定義と要求・応答の文脈検証責任も、実装者が異なる契約を作れる余地を残している。
これらは仕様・fixture・実装テストの期待結果を一意に定めるために修正が必要である。

## Required Changes

### SR-001

- Priority: Critical
- 対象箇所: `spec.md` 5.7 314〜325行、338行、13章 687行、2章 51行
- 問題: `connection-request` には権限配列の定義順が明記されているが、`connection-response` の `connection-signing-permission` の反復には順序規則がない。両方の署名権限を許可する同じ論理subsetについて、`sign-transaction` と `sign-message` の並びを入れ替えた2つの配列が仕様上区別されないまま受理できる。
- 根拠: 仕様本文 `connection-approved-with-account`、`connection-approved-without-account`、および決定性の原則。要件本文 `FR-005`、`FR-015`、`AC-003`、`AC-011`。
- 影響: 同じ論理応答から複数のCBOR byte列が生成され、実装間のbyte-for-byte比較、response fixture、権限subsetの適合判定が分岐する。
- 修正内容: 承認responseのpermissionsにも一意のcanonical順序を定義し、その順序以外を拒否する。accountあり・なし、権限が1件・2件の各境界と並び違いの拒否fixtureを追加する。
- 修正完了条件: 各許可権限集合について受理される配列順が1通りだけとなり、同じ論理responseの期待CBORと拒否時のerror codeをfixtureから判定できる。

### SR-002

- Priority: Critical
- 対象箇所: `spec.md` 6.1 456行、7.2 507〜515行、8章 582行・607行、13章 685行・692行
- 問題: 公開APIは `Password = string | Uint8Array` を受け付ける一方、暗号プロファイルはpasswordをUTF-8へ変換するとだけ定めている。`Uint8Array` が既にKDFへ渡すpassword bytesなのか、UTF-8として検証・再変換する入力なのか、また最大長・不正UTF-8の扱いが定まっていない。
- 根拠: 仕様本文 `Password`、password-v1、`deriveArgon2id` provider API。要件本文 `FR-010`、`AC-003`、`AC-008`。
- 影響: 同じAPI入力でもKDF入力、暗号文、復号結果、password fixtureが実装ごとに異なり、暗号化データの相互運用性と受入判定を確定できない。
- 修正内容: 受け付けるpassword入力形式を選択し、各形式からKDFへ渡す厳密なbyte列、空値、長さ上限、UTF-8検証、stringとUint8Arrayの同値性を規定する。型ごとのpassword-v1 fixtureを追加する。
- 修正完了条件: stringおよびUint8Arrayの各入力についてKDF入力byte列、拒否条件、期待ciphertext、復号時の期待結果が仕様から一意に判定できる。

### SR-003

- Priority: Critical
- 対象箇所: `spec.md` 4.5 207〜215行、8章 597〜598行、9章 623行、13章 689行
- 問題: text representationは `snif1:` prefixとBase64URL suffixで構成されるが、4.5はdecoded byte列をcanonicalに再encodeした結果が「入力全体」と一致しなければ拒否すると記載している。Base64URLの再encode結果がsuffixだけを指すのか、prefixを含むcanonical text全体を指すのかが定義されておらず、`decodeText`のprefix検証との比較単位も一致していない。
- 根拠: 仕様本文 4.5の形式・canonical性規則と `encodeText` / `decodeText` API。要件本文 `FR-011`、`AC-001`、`AC-018`。
- 影響: 実装がprefixを含めて比較するかsuffixだけを比較するかで、正常textを拒否したり、canonicalでない表記を受理したりし、textとbinaryの相互変換が一意に検証できない。
- 修正内容: canonical encoderの出力を `snif1:` を含む完全なtextと定義し、decode時はprefixを除いたsuffixをcanonical Base64URL化して比較するなど、比較対象を一つに固定する。空、padding、非zero pad bitを含む境界fixtureを追加する。
- 修正完了条件: 任意の正常binaryについてcanonical textが1通りに定まり、`decodeText(encodeText(x))` と各不正表記の期待error codeをfixtureから判定できる。

### SR-004

- Priority: Critical
- 対象箇所: `spec.md` 5.8 347〜356行、5.9 358〜376行、14章 720行
- 問題: 要件は表示用情報と実際の署名対象byte列を区別して表現することを求めているが、signing-request schemaには `payload` と `purpose` しかなく、`purpose`が表示用情報なのか、署名対象・表示内容との関係をどう扱うのかが定義されていない。fixture要件の「表示用文字列と異なる署名対象byte列」を構成する規範的なfieldもない。
- 根拠: 要件本文 `FR-018`、`AC-014`。仕様本文 signing-requestのschemaと「codecは意味・表示内容との一致を検証しない」という責任境界。
- 影響: 実装者が表示情報を省略する、`purpose`を署名対象の一部として扱う、または別の暗黙fieldを追加するなど、署名要求の論理モデルとfixtureが分岐する。利用者へ表示する内容と署名対象の取り違えを独立に検証できない。
- 修正内容: 表示用情報と署名対象byte列をそれぞれ規範的に表現するか、v1で表示用情報を扱わないことを承認してFR-018/AC-014と追跡表・fixtureを更新する。両者の関係をcodecが保証する範囲とhostが判断する範囲も明記する。
- 修正完了条件: AC-014の入力、表示用値、署名対象byte列、codecの検証結果、およびhost側の判断主体が仕様とfixtureから一意に判定できる。

### SR-005

- Priority: Major
- 対象箇所: `spec.md` 8章 560〜580行、594〜609行、9章 613〜631行
- 問題: 公開APIの `AddressPayload`、`ContactPayload`、`AccountPayload` などの型名が、CDDLからのTypeScript型への対応規則を含めて仕様内で定義されていない。さらに、error codeを公開するという要件に対するerror objectの形、`code`の保持場所、provider例外の変換契約も定義されていない。
- 根拠: 仕様本文 5章のCDDL、8章の公開API、9章のエラー仕様。要件本文 `NFR-006`、`NFR-007`、`AC-017`。
- 影響: 各実装がoptional field、再帰的object、chain/networkの型付け、エラーの検査方法を独自に決めるため、同じAPI契約とfixture追跡を第三者が確認できない。
- 修正内容: 公開APIで参照する全payload型と、CDDLの各制約・条件付き必須項目を型定義へ対応付ける。error objectの最小形、機械判定するcodeの取得方法、既知のprovider例外からの変換規則を定義する。
- 修正完了条件: 公開APIに参照未定義の型名がなく、各error codeを同じ方法で取得でき、payload制約とAPI型の対応を第三者が追跡できる。

### SR-006

- Priority: Major
- 対象箇所: `spec.md` 4.3 177〜186行、5.7 338〜342行、5.11 402行、9章 625行、13章 696〜709行
- 問題: decode手順は `requestId` とpermissionの整合性を確認すると記載する一方、responseが元requestのpermission subsetであること、requestIdが元requestと一致すること、期限・replayを確認するには元requestとhost状態が必要であり、codec単体では証明しないとも記載している。`invalid-context`をcodecが返すのかhostが返すのか、host-context fixtureがsubset不一致やrequestId不一致をどう表すのかが定まっていない。
- 根拠: 仕様本文のdecode手順、connection-responseの責任境界、host-context fixture。要件本文 `FR-014`、`FR-015`、`FR-019`、`AC-010`〜`AC-013`。
- 影響: 同じ不正responseをcodecで拒否する実装とhost検証へ渡す実装が成立し、error category、APIの責任、fixtureの期待結果が分岐する。接続承認の最小権限を適合性試験で再現できない。
- 修正内容: standalone codecが検証するpayload内の構造条件と、元request・現在時刻・replay状態を受け取るhost/context検証の条件を分離する。各条件の検証主体、入力、結果、error codeを定義し、subset不一致・requestId不一致・期限・replayのhost-context fixtureを追加する。
- 修正完了条件: codec単体とhost/context検証の責務が重複せず、各不正条件について入力・検証主体・期待結果・error codeが一意に追跡できる。

## Optional Improvements

### SR-010

- Priority: Minor
- 対象箇所: `spec.md` 14章 728〜731行、15章 760〜764行
- 改善内容: 仕様本文が過去のレビューID `SR-001`〜`SR-004`と、上書きされるレビュー成果物の判定を固定参照しているため、レビュー更新後も旧ID・旧判定を参照し続ける構造を整理する。
- 根拠: 仕様本文の要件・レビュー追跡表と作成状況。
- 影響: 後続レビューで指摘IDが変わった際、対応状況と現行レビュー結果の追跡が不正確になる。

## Review Gates

| Gate                                         | 結果   | 根拠                                                                                                                                                         |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 目的と範囲                                   | 合格   | `spec.md` 1〜2章。対象機能、対象外の搬送・意味検証、責任境界が記載されている。                                                                               |
| 機能と制約                                   | 不合格 | SR-001〜SR-005。決定性、暗号password、text、署名表示情報、公開API契約が一意でない。                                                                          |
| 処理と例外                                   | 不合格 | SR-002、SR-003、SR-004、SR-006。暗号入力、text拒否、署名要求、context検証の処理主体または期待結果が未確定である。                                            |
| 内部整合性                                   | 不合格 | SR-001、SR-003、SR-004、SR-006。決定性、text比較、要件の署名表現、codecとhostの責任境界に不整合がある。                                                      |
| 検証可能性                                   | 不合格 | SR-001〜SR-006。正常・拒否fixture、API型、error code、cross-message検証の期待結果を一意に再現できない。                                                      |
| 不可欠な前提の現実性と安全性                 | 不合格 | SR-002、SR-004、SR-006。暗号KDF入力、表示と署名対象の境界、接続承認の検証主体が未確定である。                                                                |
| コンセプト・要件定義との整合性と前段品質判定 | 不合格 | SR-002〜SR-004、SR-006。コンセプトレビューと要件レビューの前段判定は合格だが、現仕様がFR-010、FR-011、FR-018、FR-019とAC-003、AC-014を一意に反映していない。 |

## Final Decision

仕様の修正を優先する。
決定的wire、暗号化、text搬送、署名要求、接続応答のいずれも、実装間で同じ入力から同じ結果を得るための条件が一部未確定である。
SR-001〜SR-004を解消し、SR-005〜SR-006を公開API・fixture・責任境界へ反映してから実装を開始する必要がある。
