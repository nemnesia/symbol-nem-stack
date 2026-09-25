# SymTax Implementation Review 001

## Review Target

- **対象:** `apps/symtax`、commit `993f060` (`feat: [apps/symtax] アプリ基盤とMongoDB分離境界を実装`)
- **確認日:** 2026-09-25
- **成果物:** Phase 1アプリ基盤、Domain / Application contract、およびMongoDB分離境界
- **レビュー範囲:** 承認済みSpecificationへの適合、別MongoDB instance境界、型契約、入力検証、fail-closed、テスト・build
- **未確認範囲:** 実Symbol Node MongoDBとの接続・read-only権限、実際の独立MongoDB instance間のintegration、Mainnet/Testnet実Nodeのidentity照合、Symbol raw data正規化、価格・Cryptact機能（Phase 1対象外）

## Execution Audit

- **Pass 1 — Specification conformance:** `SPEC-NET-*`、`SPEC-IN-*`、`SPEC-PAGE-*`、`SPEC-TX-*`、`SPEC-RCPT-*`、`SPEC-NUM-*`、`SPEC-STORE-001`とPhase 1差分を照合した。
- **Pass 2 — Security / trust boundaries:** server-only境界、Mongo接続設定・権限面、Network fail-closed、外部入力、ログへの秘密情報露出を確認した。
- **Pass 3 — Failure modes / data integrity:** invalid・unknown・partial・incompleteの表現、continuation再利用・改変、DB接続失敗・closeを確認した。
- **Pass 4 — Test / implementation quality:** unit test、型検査、lint、format、production build、Compose構成検証を実行した。
- **実施者:** Chairによる独立した4観点のself-review。サブエージェントは使用していない。

## Evidence Used

| 資料 | 用途・結果 |
|---|---|
| `apps/symtax/docs/specification.md` | 外部契約、状態、MongoDB独立instance要件、Conformance Caseを確認 |
| `apps/symtax/docs/design.md` | server / adapter境界、read-only Node DB、SymTax Store所有、Network境界を確認 |
| `apps/symtax/docs/requirements.md` | 主要なSecurity / Performance / data completeness要件を確認 |
| `apps/symtax/docs/reviews/specifications/specification-review-002.md` | 上流Specification ReviewがREADYであること、SR-008 Minorを確認 |
| `apps/symtax/docs/reviews/implementation/implement-spec-feedback.md` | `IF-001` continuation token integrityに関する既存feedbackを確認 |
| `.agents/skills/implement-review/*`, `.agents/skills/review-common/*`, `AGENTS.md` | Review gate、出力形式、根拠区分を適用 |
| commit `993f060` | 実装差分とレビュー対象範囲を確認 |

## Review Result

**READY**

## Summary

Next.js基盤、環境ごとに固定するserver-side network configuration（開発用Testnet pinを含む）、Address / JST period / quantity / Browse request contract、およびSymbol MongoDB read-only handleとSymTax MongoDB writable handleの分離が実装されている。Symbol側にwrite APIを公開しない構造、`hello`によるprocess identity照合、同一process / 同一replica set / mongosの拒否、片側接続失敗時のclose処理は、今回のMongoDB分離要件に沿っている。

lint、format、typecheck、32 tests、production build、Compose configはいずれも成功した。一方、Normalized record型がSpecificationで定める一部の`incomplete`状態を表現できず、continuationの妥当なpayload改変を検知できない。いずれも現在のPhase 1でraw履歴を取得・Exportする実装はなく、MEDIUMの非阻害指摘として記録する。後者は既存`IF-001`とも関連し、continuationを実queryへ接続する前にSpecification側でintegrity契約を解消する必要がある。

## Finding Status

| ID | Severity | Status | 初出レビュー | 今回の状態根拠 |
|---|---|---|---|---|
| IR-001 | MEDIUM | New | Implementation Review 001 | recognized Transaction / Receipt型のcompleteness unionが`incomplete`を含まず、必要なidentity / Block / Statement情報が欠けたrecordを型安全に表現できない |
| IR-002 | MEDIUM | New | Implementation Review 001 | 同じquery bindingを保ったままlast ordering keyを別の構文妥当値へ変更したcontinuationをdecodeが受け入れる。Specificationは改変tokenを拒否すると定める |

## Required Changes

なし。CRITICAL / HIGHのNew / Open / Reopened findingはない。

## Optional Improvements

### IR-001 — Normalized modelがrecognized recordのincomplete状態を表せない

- **Severity:** MEDIUM
- **対象箇所:** `apps/symtax/src/domain/records.ts:32-43,166-184,191-209,244-270`
- **発生条件 / 確認事実:** Transactionの共通型は`identity`、`blockReference`、`signer`、`sourceReference`を必須とし、recognized Transactionの`completeness`は`complete | partial`に限定される。Receiptも`identity`と`sourceReference`を必須とし、recognized Receiptのcompletenessは`complete | partial`に限定される。Receiptの`statementSource`や`blockReference`はnullableだが、必須source identity自体が欠けた状態を安全に表す型になっていない。
- **根拠:** `SPEC-TX-001/002`はcommon identity / Block / signer等の欠落を`incomplete`とする。`SPEC-RCPT-001/002`もidentity / Statement source / height / Block解決欠損を`incomplete`とし、`CT-050`および`CT-055`で空identityや代替timestampを禁止している。Phase 1依頼はこれらの状態をNormalized contractで表現することを求める。
- **問題:** 後続Normalizerは、recognized typeの共通必須値欠損をこの型で表現できず、値を捏造するか、recordを型外へ落とす必要が生じる。どちらも欠損の外部伝播を難しくする。
- **影響:** incomplete履歴の識別・表示・Export拒否を後続Phaseで一貫して実装しにくい。現Phaseにraw adapter / Exportはなく、現在の利用者へ不完全データを完全結果として返す経路は未実装。
- **必要な最小修正:** incompleteなsource recordを偽値なしで表現できるunion / variantを追加し、recognized / unknown分類とcompletenessを独立に保つ。既存のknown complete / partial semanticsは維持する。
- **完了条件 / 再確認:** CT-050相当のrecognized TransactionがBlock / identity欠損で`incomplete`として表現でき、CT-055相当のReceiptがStatement / Block欠損でtimestamp unavailableとincompleteを表現できる。空文字、0、架空のreferenceを補わない。

### IR-002 — continuation payloadの意味ある改変を検知できない

- **Severity:** MEDIUM
- **対象箇所:** `apps/symtax/src/domain/pagination.ts:59-75,77-160`
- **発生条件 / 確認事実:** `encodeContinuation`はJSON payloadをbase64url化するだけで、`decodeContinuation`は構文とrequest bindingを検証する。同じaddress、network、category、period、page sizeのまま`lastKey`や`SnapshotTip`を別の形式妥当値へ変更して再encodeしたtokenは、decodeで成功し得る。
- **根拠:** `SPEC-PAGE-003`は改変・破損tokenを`invalid-continuation`として拒否する。既存`implement-spec-feedback.md`の`IF-001`は、仕様にintegrity方式がないことを記録し、query接続前に上流判断が必要としている。
- **問題:** 構文的に有効な改変値と発行済みtokenを区別できず、将来このcursorを履歴queryへ接続した際にページを飛ばす・異なるsnapshotを指す可能性がある。
- **影響:** 完全な履歴coverageとページ間の整合性を損なう可能性がある。Phase 1には実履歴queryや公開Browse endpointがなく、現時点のデータ欠落への直接経路は存在しない。
- **必要な最小修正:** `IF-001`に従い、Specificationで改変検知の外部契約と鍵 / stateの責任境界を確定した後、その契約に適合させる。未承認の独自署名方式や秘密設定をこの実装だけで追加しない。
- **完了条件 / 再確認:** 正規tokenの`lastKey` / snapshot部分を変更したtokenが`invalid-continuation`となり、正規発行tokenの継続とquery binding拒否は維持される。実query統合前に確認する。

## Resolved Findings

なし。Implementation Review 001より前の正式なImplementation Reviewはない。

## Upstream Feedback

### IF-001 — Continuation token integrity（既存feedbackの継続）

- **送信元フェーズ:** Implementation Review
- **受領すべき上流フェーズ:** Specification
- **対象となる正式資料 / decision:** `specification.md` の`SPEC-PAGE-003`、既存`implement-spec-feedback.md`の`IF-001`
- **不足・曖昧さ:** 改変token拒否という外部結果は定義されるが、改変検知方法と必要なkey/state lifecycleは定義されていない。
- **下流への影響:** Phase 1 codecでは構文・binding検証のみ実装できる。cursorを実queryへ接続する場合、全条件の継続性とtamper rejectionを両立する実装を決められない。
- **non-normative status:** このfeedbackは新しいSpecification contract / key-management decisionではない。既存`IF-001`を引き継ぎ、IR-002の上流依存として参照する。
- **解消条件:** Specificationでtoken integrity保証の範囲と必要なserver state / secret lifecycleを承認済み契約として定義し、対応Conformance Caseを追加する。

## Deferred Findings

- Docker daemonへ接続できなかったため、2つの実MongoDB instanceによるintegration、init scriptの実行、実際のcredential role確認は未実施。unit testは異なるprocess identityをmockしている。
- Symbol MongoDBのread-only権限は専用ユーザーの運用設定が前提で、実Nodeへの接続試験で確認していない。
- `SPEC-STORE-001`の異なる`mongod` process確認は接続時の`hello.topologyVersion.processId`照合で補助されるが、別volume / credential / lifecycle / resource設定はdeployment evidenceによる受入確認が必要。
- `SPEC-NET-*`のobserved identity照合はpure contractまでで、Nodeからのevidence取得はPhase 2以降。
- Specification Review 002の`SR-008`は文書上のMinorとして未修正。今回実装レビューの対象コードではない。

## Scope and Traceability

- 対象はcommit `993f060`の`apps/symtax`と依存lockfileのSymTax追加分。
- MongoDB設定は`SYMBOL_MONGO_*`と`SYMTAX_MONGO_*`で独立し、旧`MONGO_URI` fallbackはない。
- `connectMongoStores`はSymbol側に`find`のみのhandleを公開し、SymTax側にread/write collection APIを公開する。Node側connectionはSymTax接続失敗時にも閉じられる。
- runtime Network identity、Address、period、common result、normalized records、pagination、quantityはそれぞれDomain / Server / Application境界に配置されている。
- Phase 2以降のSymbol raw document mapping、価格取得・保存・評価、Harvest集約、Cryptact Exportは実装対象外として維持されている。

## Domain Checks

| 観点 | 判定 | 根拠 |
|---|---|---|
| Specification conformance | 部分合格 | Address / Network / JST period / numeric / Mongo separation contractの主要実装を確認。IR-001/002は非阻害の契約不一致。 |
| Security / trust boundaries | 合格（実環境確認をDeferred） | Server configとMongo接続は`server-only`。Browser bundleへDB URIを渡す経路を確認せず、Symbol handleはfindのみ。Mongo role・volume等の実配置は未確認。 |
| Failure / data integrity | 部分合格 | 接続失敗・identity不明は失敗し、空データ扱いしない。continuation tamperingとrecognized incomplete modelはIR-001/002。 |
| Interoperability | Phase 1範囲で合格 | Network byte、Symbol address checksum、JST boundary、native quantity stringを実装。実Node API/DB mapperは未実装。 |
| Tests | 合格（実integration未実施） | 11 test files / 32 testsが成功。実Mongo container / Symbol Nodeは未検証。 |
| Implementation quality | 合格 | TypeScript、lint、format、production buildが成功。Phase 1 scope外のadapterやprice/export実装なし。 |

### Security checklist適用状況

- **適用:** server / client trust boundary、secret configuration exposure、MongoDB privilege separation、fail-closed、attacker-controlled address / period / continuation、error detail leakage、network binding。
- **適用外:** private key / mnemonic、signing / transaction submission、cryptographic signing、FFI / native memory、wallet key lifecycle。SymTax Phase 1には該当処理がない。
- **未確認:** 実MongoDB user role、実稼働URIの秘密管理、運用log、実コンテナ間ネットワーク、実Node read-only接続。

## Validation Results

| 検証 | 結果 |
|---|---|
| `pnpm --filter @symbol-tools/symtax lint` | 成功 |
| `pnpm --filter @symbol-tools/symtax format:check` | 成功 |
| `pnpm --filter @symbol-tools/symtax typecheck` | 成功 |
| `pnpm --filter @symbol-tools/symtax test` | 成功 — 11 files / 32 tests |
| `pnpm --filter @symbol-tools/symtax build` | 成功 — Next.js production build |
| `docker compose --env-file apps/symtax/.env.example -f apps/symtax/compose.yaml config --quiet` | 成功 |
| 実MongoDB integration | 未実施 — Docker daemon socketへの接続権限がなく、実instanceを起動できない |
| git worktree | レビュー開始時clean。レビュー成果物以外の変更なし |

## Review Gates

| Gate | 判定 | 根拠 | 対応ID |
|---|---|---|---|
| 1. Specification conformance | 部分合格 | Phase 1中心契約は実装済み。incomplete normalized stateとcontinuation改変検出に限って不一致。 | IR-001, IR-002 |
| 2. Security / trust boundaries | 合格（実運用確認Deferred） | Node DB write APIを公開せず、2 store接続を明示分離。runtime process identityと同一replica setを拒否。 | — |
| 3. Interoperability | 合格（Phase 1範囲） | Network、Address、timestamp/quantity境界は各固定契約に沿う。実Node mapping未実装。 | — |
| 4. Failure / attacker-controlled input | 部分合格 | malformed / mismatchを検証するが、妥当なcontinuation payload改変は検出できない。 | IR-002 |
| 5. Tests | 合格（Integrationは未確認） | 32 unit tests成功。実MongoDB接続と運用権限の検証は別途必要。 | — |
| 6. Type / implementation quality | 部分合格 | lint / typecheck / buildは成功。normalized record型で一部incompleteを表現できない。 | IR-001 |

## Remaining Risks and Open Decisions

- IR-002に関連するcontinuation token integrityの仕様決定が必要。実履歴queryへ接続する前に解消する。
- IR-001のincomplete normalized variantsを後続Normalizer実装より前に追加する。
- 実MongoDB instance isolation、read-only role、storage / lifecycle / resource separationはDockerが利用可能な環境で運用構成を検証する。
- Symbol Node profileとraw mapping qualificationはOPEN-007のとおり後続Phaseで実施する。

## Automatic Changes

レビュー成果物`apps/symtax/docs/reviews/implementation/implementation-review-001.md`のみを作成した。実装、仕様、テストは変更していない。

## Final Decision

**READY** — MEDIUMの非阻害指摘2件がある。現在のPhase 1は起動・build可能で、CRITICAL / HIGHの欠陥は確認されていない。continuation codecを履歴queryへ接続する前にIF-001を解決し、Normalizer導入前にIR-001を再確認する。
