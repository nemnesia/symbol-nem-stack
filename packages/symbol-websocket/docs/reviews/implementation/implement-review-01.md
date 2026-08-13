# Implementation Review Findings

## Review Target

- 対象: `packages/symbol-websocket` の現行実装、公開型、ユニット/E2Eテスト、README、依存関係および提示されたSW-SEC-001〜006
- 確認日: 2026-08-11 10:07 JST
- レビュー範囲: `src/`、`test/`、`e2e/`、README、CHANGELOG、`package.json`、lockfile、関連するNEM実装、`docs/knowledge`、公式Symbol/Node.js/`ws`資料
- 未確認範囲: 実Gateway接続、実通知を用いたMainnet/Testnet相互運用、E2E秘密鍵を用いる外部ネットワーク検証、承認済みWebSocket仕様書またはADR（リポジトリ内で未確認）

## Execution Audit

- 実行モード: `multi_agent_v1__spawn_agent` で起動した4つの独立した Reviewer サブエージェント
- Reviewer A agent_id: `019fee56-fa71-72f0-b67c-3a0084b2f47d`
- Reviewer B agent_id: `019fee57-0dac-74f1-991f-1f8aec79e5db`
- Reviewer C agent_id: `019fee57-2439-7e80-a836-9100de384ae4`
- Reviewer D agent_id: `019fee57-3a7b-7263-9c56-06d39f013a3f`
- Phase 1: 完了。4 Reviewerを個別の `multi_agent_v1__wait_agent` で確認し、全メモを受領
- Phase 2: 完了。全メモを同じ4 Reviewerへ個別送信し、4件の `submission_id` に対応する完了を個別確認
- Chair 統合: 完了

## Evidence Used

| 種別 | 参照箇所 | 用途 |
| --- | --- | --- |
| 実装コードまたは差分 | `packages/symbol-websocket/src/SymbolWebSocket.ts:67-125,140-161,226-290,334-365` | host、受信JSON、UID、通知配送、再接続、サイズ検査の確認 |
| 実装コードまたは差分 | `packages/symbol-websocket/src/symbolChannelPaths.ts:24-50`、`symbolNotifications.types.ts:13-160` | チャネル、アドレス形式、静的通知型の確認 |
| テストまたは fixture | `packages/symbol-websocket/test/SymbolWebSocketMonitor.test.ts:51-72,224-272,440-615`、`paths.test.ts` | host、UID、購読、通知topic、再接続、アドレス検証の確認 |
| テストまたは fixture | `packages/symbol-websocket/e2e/SymbolWebSocket.e2e.test.ts:12-39,101-110,159-212` | E2E環境変数、REST announce先、外部接続範囲の確認 |
| プロジェクト資料 | `packages/symbol-websocket/README.md:63-85,104-125`、`.env.example:1-3`、`CHANGELOG.md:7-13` | 公開契約、E2E設定、実行時検証の記載確認 |
| 承認済み仕様 | 未確認 | 対象パッケージの承認済みWebSocket仕様書・ADRは確認できず、仕様違反判定の根拠には使用していない |
| 技術資料 | [Symbol REST Gateway WebSockets](https://docs.symbol.dev/api.html) | UID、subscribe形式、`{ topic, data }` envelopeの外部仕様確認 |
| 技術資料 | [Node.js URL documentation](https://nodejs.org/api/url.html) | WHATWG URLのcanonicalizationに関する提示主張の確認 |
| 技術資料 | [`ws` API documentation](https://github.com/websockets/ws/blob/master/doc/ws.md) | Node版の既定 `maxPayload` 100 MiBの確認 |
| 技術資料 | [Node.js release schedule](https://github.com/nodejs/release) | Node.js 20のEOL日（2026-04-30）の確認 |
| 技術資料 | [`ws` releases](https://github.com/websockets/ws/releases) | `ws` 8.21.1がリリース一覧にあることの確認 |
| 公式実装・プロジェクト実装 | `packages/nem-websocket/src/stompFrameSizeGuard.ts`、`NemWebSocket.ts`、`packages/nem-websocket/package.json` | STOMPはNEM版に存在し、Symbol版の依存・実装には存在しないことの確認 |

## Review Result

公開可能

## Summary

提示された6件のうち、サイズ制限、UID形式、通知のruntime schema、再接続、checksum/network、Node EOLはコードまたは外部資料上の事実・条件付きリスクとしては確認できる。
しかし、対象パッケージの承認済みWebSocket仕様・ADRに、それらを必須制約またはライブラリ保証とする根拠は確認できず、Major/Criticalの実装欠陥としては採用しない。
Node版 `ws` には既定100 MiBの上限があり、Symbol版にはSTOMP実装がないため、提示資料の「無制限」「STOMP蓄積」の表現はそのままでは正確でない。
現行範囲で具体的に採用するのは、E2EのREST URL設定契約不一致と、unit/E2Eのcoverage実行境界の不明確さのMinor 2件である。

## Required Changes

なし

## Optional Improvements

### IR-001

- Priority: Minor
- 対象箇所: `packages/symbol-websocket/e2e/SymbolWebSocket.e2e.test.ts:15-18,37,101-105`、`packages/symbol-websocket/README.md:65-85`、`.env.example:1-3`
- 改善内容: READMEは `SYMBOL_E2E_REST_URL` を設定項目かつE2E有効化条件として説明するが、E2E実装は同変数を読まず、`SYMBOL_E2E_HOST` と `SYMBOL_E2E_SSL` からREST URLを生成する。`.env.example` にもREST URLがない。設定契約を一つに揃える必要がある。
- 根拠: プロジェクト資料およびE2E実装。Phase 1の4 Reviewerが同一事象を確認し、Phase 2で重複統合した。
- 影響: WebSocketノードとRESTノードを分離した設定で、署名済みテストネットtransactionのannounce先が設定者の意図と異なる、またはE2Eのskip条件がREADMEと一致しない。

### IR-002

- Priority: Minor
- 対象箇所: `packages/symbol-websocket/package.json:42-46`、`packages/symbol-websocket/e2e/SymbolWebSocket.e2e.test.ts:12-39,193-212`、`README.md:79-85`
- 改善内容: `test` と `test:e2e` は分離されている一方、`test:coverage` は `--dir test` を指定せず、環境変数が存在する場合に外部ネットワーク依存のE2Eを含み得る。coverageの対象範囲とE2Eの実行条件を既存のunit/E2E契約と一致させる必要がある。
- 根拠: package metadata、README、E2E実装、Phase 1での `test:coverage` 実行報告。E2E 2件が既定timeoutで失敗したとの報告はあるが、Chairは秘密鍵・外部ネットワークを用いるため再実行していない。
- 影響: 通常のcoverage検証が外部ノード、ネットワーク状態、秘密鍵設定に依存し、再現性なく失敗する可能性がある。

## Specification Conformance

- 適合している要件: Symbol公式資料に示されるWebSocketのUID取得、`{ uid, subscribe }`形式、`{ topic, data }` envelopeとの整合（`SymbolWebSocket.ts:250-290`）。`ws://host:3000/ws` / `wss://host:3001/ws`、チャネルパス、購読復元、callback解除は公開JSDoc・README・テストと整合する。
- 不適合の要件: なし。承認済みWebSocket仕様が未確認のため、提示された追加制約を既存要件とは扱わない。
- 実装されていない要件: なし。
- 仕様が曖昧で判定できない要件: 受信メッセージ最大サイズ、UIDの形式・真正性、通知payloadのruntime schema検証、TLS必須性、再接続試行回数のリセット単位、Symbol addressのchecksum/network検証、E2EのREST URL契約。これらは実装欠陥ではなく、仕様未決定事項として分離した。

## Test Evaluation

- 十分に検証されている範囲: host入力、endpoint生成、チャネル・アドレス境界、UID handshake、subscribe/unsubscribe、topic完全一致配送、callback例外隔離、timeout、manual disconnect、再接続と購読復元。
- カバレッジ: Phase 1の既存coverage報告は Statements 93.06%、Branches 84.43%、Functions 93.47%、Lines 93.64%。Branch 90%未満だけではゲート不合格としない。重要な不足としてIR-001/IR-002に関係するE2E設定・実行境界がある。
- 不足しているテスト: IR-001のREST URL設定契約とskip条件、IR-002のunit-only coverageとE2E分離条件。checksum不正、canonicalization、UID長、通知schema、サイズ超過は仕様根拠がないため必須テスト不足とはしない。
- fixtureまたは期待値の問題: `SymbolWebSocketMonitor.test.ts:238-249` は `{ topic: 'block', foo: 'bar' }` をtopic配送の確認に使用している。runtime schema検証を要求する仕様がないため、fixture欠陥とは採用しない。
- 実行された検証: `pnpm --filter @nemnesia/symbol-websocket test`（83/83成功）、`pnpm --filter @nemnesia/symbol-websocket lint`（成功）、`pnpm --filter @nemnesia/symbol-websocket exec tsc --noEmit`（成功）。
- 実行されていない検証: Chairによる実Gateway接続、`test:e2e`、`test:coverage`の再実行、実通知を用いたMainnet/Testnet相互運用、依存脆弱性監査、publish artifact確認。Phase 1 Reviewerからはunit coverage値と`test:coverage`のE2E失敗報告を受領した。

## Review Gates

| Gate | 結果 | 根拠 |
| --- | --- | --- |
| 仕様適合性 | 合格 | 承認済みWebSocket仕様は未確認。確認できた公式wire形式・公開契約・実装は整合し、仕様未決定事項を不適合へ昇格していない。 |
| セキュリティ | 合格 | SW-SEC-001〜006のうち、既存仕様に基づくCritical/Majorは確認されず。サイズ・TLS・通知真正性等は残存リスクまたは未決定事項として分離。 |
| 相互運用性とプロトコル | 合格 | Symbol公式のUID、subscribe、topic/data envelope、チャネルパスと実装が整合。NEM版のSTOMP処理はSymbol版へ混入していない。 |
| 処理と異常系 | 合格 | 既存unit testで接続、parse error、購読、再接続、解除、callback例外を確認。runtime schema/size上限は仕様根拠なし。 |
| テスト十分性 | 合格 | 83 unit tests、lint、typecheckが成功。Branch未達だけを理由に不合格とせず、具体的な設定・実行境界はIR-001/IR-002へ分離。 |
| 変更範囲内の品質 | 合格 | 現行実装に対する採用指摘はMinor 2件。公開範囲を阻害するCritical/Majorはなし。 |

## Remaining Risks

- `SymbolWebSocket.ts:231-289` はJSON parse後にtopicだけを確認し、TypeScriptの `SymbolNotificationMap` をruntime検証しない。これはコード上確認できるが、通知真正性・schema保証を本パッケージの責務とする承認済み仕様がないため、今回の実装欠陥には採用していない。利用者が悪意あるGatewayを信頼しないことを前提にしたリスクが残る。
- `SymbolWebSocket.ts:140-145` はSymbol addressを文字種・長さで検証するが、checksum/network byteの検証はしない。NEM版にはtestnet checksum検証がある一方、Symbol版で同等検証が必須という仕様は未確認である。
- `SymbolWebSocket.ts:80-97` はWHATWG URLのcanonicalized hostnameを検査し、接続時は元のhost文字列を使用する。canonicalization自体は公式Node資料に沿うが、ライブラリはprivate IP deny/allowlistを提供しておらず、外側のSSRF判定を回避できる具体的な呼び出し元は未確認である。
- `SymbolWebSocket.ts:56-60,250-260,334-365` は固定interval、`maxReconnectAttempts: Infinity`、UID受信時のカウンタリセットを実装する。これらは公開設定・JSDocに記載される動作であり、有限試行回数の意味（連続失敗か総試行か）を定める承認済み仕様は未確認である。
- `package.json:53-54` は `isomorphic-ws` と `ws` をcaret rangeで宣言し、lockfileは `ws@8.21.1` を解決している。公式 `ws` docsによればNode側の既定 `maxPayload` は100 MiBで、受信上限が完全な無制限という主張は正確ではない。ブラウザ側はnative WebSocketの制約に依存する。
- `package.json:62-64` とmonorepo rootはNode `20.19.6`をVoltaで選択する。Node公式release scheduleでは20.xのEOLは2026-04-30である。ただしVolta設定は公開利用者のruntime強制ではなく、現行packageにengines要件もないため、今回の実装セキュリティfindingには採用していない。
- Symbol版にはSTOMP依存・STOMP parserはなく、STOMP frame guardはNEM版にのみ存在する。したがってNEM版のSTOMP frame蓄積問題をSymbol版へ適用する根拠はない。

## Final Decision

公開可能

CriticalおよびMajorの採用指摘はなく、現行範囲の品質ゲートは合格と判定する。E2E設定契約とcoverage実行境界にはMinorの修正余地があるが、公開可否を阻害する問題ではない。承認済みWebSocket仕様が追加提示された場合は、サイズ・UID・通知schema・address検証・再接続の判定を再評価する。
