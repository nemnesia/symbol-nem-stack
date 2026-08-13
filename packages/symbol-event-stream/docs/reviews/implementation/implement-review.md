# Implementation Review Findings

## Review Target

- 対象: `packages/symbol-event-stream` の現在のワークツリー差分、実装、テスト、README、CHANGELOGおよび公開型
- 確認日: 2026-08-13 08:48 JST
- レビュー範囲: `NodeProvider` callback、候補補充、single-flight、候補URL検証・重複排除、blacklist、切替・購読復元、`close()`競合、公開APIおよび追加テスト
- 未確認範囲: 本パッケージ専用の承認済み仕様書・ADR、実ノードE2E、別SDK・別言語相互運用、Provider候補によるWebSocket生成・購読復元失敗の実環境検証

## Execution Audit

- 実行モード: `multi_agent_v1__spawn_agent` で起動した4つの独立した Reviewer サブエージェント
- Reviewer A agent_id: `019ff85d-e371-71e0-9205-422edef828b8`
- Reviewer B agent_id: `019ff85e-03e1-7892-8ea8-3f4bcd3a5457`
- Reviewer C agent_id: `019ff85e-1c01-74a0-b55c-2aca489b7b41`
- Reviewer D agent_id: `019ff85e-3436-7570-bcc4-7edf39fb1c26`
- 起動再試行: なし
- Phase 1: 完了。各 Reviewer の `multi_agent_v1__wait_agent` で個別に確認
- Phase 2: 完了。同じ4つの Reviewerへ個別送信し、各 submission の完了を `multi_agent_v1__wait_agent` で確認
- Chair 統合: 完了

4つの `agent_id` は相互に異なる。実装、仕様書、fixture、テストは変更していない。

## Evidence Used

| 種別 | 参照箇所 | 用途 |
| --- | --- | --- |
| 実装コードまたは差分 | `packages/symbol-event-stream/src/SymbolEventStream.ts:260-362,421-425`; `SymbolEventStreamTypes.ts:6-42`; `src/index.ts` | Provider、候補補充、正規化キー、候補選択、blacklist、公開型の確認 |
| テストまたは fixture | `packages/symbol-event-stream/test/SymbolEventStream.test.ts:1243-1371`; `SymbolEventStream.types.test.ts:1-38` | Provider成功・失敗・不正候補・single-flight・close競合、公開型の確認 |
| ユーザー提供資料またはプロジェクト資料 | `packages/symbol-event-stream/README.md:14-20,65-75,119-127,147-196`; `CHANGELOG.md:6-11` | Provider契約、候補補充、endpoint形式、重複除外、公開APIの確認 |
| 技術資料 | `packages/symbol-nem-node-picker/README.md:99-102`; `packages/nodewatch-openapi-provider/README.md:46-64`; `@nemnesia/symbol-websocket` の接続実装 | Picker/providerの候補形式、URL検証前提、Symbol WebSocket endpoint変換の確認 |

## Review Result

公開可能

## Summary

NodeProvider callbackによる候補補充、Provider失敗時の継続、候補検証、single-flight、close後の再開抑止は、現在のREADME・公開型・実装・テストの契約と整合しています。
候補補充のためにEventStreamがPickerへ直接依存しない責務分離も、今回の公開契約と一致しています。
一方、Provider追加候補は正規化キーで重複排除されるのに対し、初期候補と使用中・blacklist候補の判定はraw URL完全一致であり、同一endpointの表記違いを二重接続し得ます。
この具体的な候補管理の不整合をMinorとして記録します。CriticalまたはMajorの欠陥は確認していません。

## Required Changes

なし

## Optional Improvements

### IR-001

- Priority: Minor
- 対象箇所: `packages/symbol-event-stream/src/SymbolEventStream.ts:336-362,421-425`
- 改善内容: Provider候補の重複排除には `getNodeKey()` の正規化キーを使用する一方、初期候補の選択と使用中・blacklist候補の除外にはURL文字列の完全一致を使用しています。そのため、`https://node.example.com` と `https://node.example.com:3001` のように、同じ許可WebSocket endpointへ変換される表記違いが初期 `nodewatchUrls` に混在すると、同じendpointへ複数接続されます。初期候補、使用中、blacklist、Provider追加候補の同一性判定を同じendpoint識別規則へそろえてください。
- 根拠: 実装コード、READMEのendpoint契約（`README.md:65`）およびProvider候補重複除外契約（`README.md:123-127`）。両表記は許可入力で、`resolveWebSocketTarget()` は同じ `ssl`/`host` へ変換します。
- 影響: `connections` の枠を同一ノードが占有し、異なるノードへの冗長接続数が減少します。Provider候補と初期候補で重複判定も不均一になります。

## Specification Conformance

- 適合している要件: 候補枯渇時の任意Provider呼出し、Providerのsingle-flight、Provider候補のendpoint検証・重複・使用中・blacklist除外、Provider失敗/空配列時の既存接続維持、切替後の購読復元、`close()`後の接続再開抑止。`README.md:65-75,119-127`、`src/SymbolEventStream.ts:260-362`、`test/SymbolEventStream.test.ts:1243-1371`で確認。
- 不適合の要件: なし
- 実装されていない要件: なし
- 仕様が曖昧で判定できない要件: Provider候補がSymbol/NEMまたはMainnet/Testnetを跨がないことの保証、Providerの同期throw・長時間未解決Promise、実ノード更新時の候補補充動作は専用承認済み仕様が未確認。IR-001は、これらとは別に、現在の候補同一性判定の具体的不整合として記録。

## Test Evaluation

- 十分に検証されている範囲: Provider成功、候補検証、空配列、reject、single-flight、Provider処理中のclose競合、既存の切替・blacklist・購読復元・rollback、公開型。
- カバレッジ: Statements 95.04% (345/363)、Branches 87.50% (182/208)、Functions 98.46% (64/65)、Lines 97.83% (317/324)。ブランチ90%未満だが、未カバー分岐だけでゲート不合格とはせず、Provider後のWebSocket生成・購読復元失敗は未確認として分離。
- 不足しているテスト: IR-001に対応する、初期候補へ同一endpointの表記違いを渡した場合の二重接続防止テスト。
- fixtureまたは期待値の問題: なし
- 実行した検証: `pnpm --filter @nemnesia/symbol-event-stream test:coverage`（88 passed、上記カバレッジ）、`pnpm --filter @nemnesia/symbol-event-stream typecheck`（成功）、`pnpm --filter @nemnesia/symbol-event-stream lint`（成功）。
- 実行されていない検証: build、実ノードE2E、別SDK・別言語相互運用、Provider候補によるWebSocket生成・購読復元失敗の実環境検証。

## Review Gates

| Gate | 結果 | 根拠 |
| --- | --- | --- |
| 仕様適合性 | 合格 | Provider契約と候補補充経路にCritical/Majorの不適合なし。IR-001はMinorの候補同一性不整合。 |
| セキュリティ | 合格 | URL検証、Provider失敗時、close競合、ログ・例外への秘密情報混入に具体的欠陥なし。 |
| 相互運用性とプロトコル | 合格 | Symbol WebSocket接続変換とProvider endpoint形式は整合。IR-001は同一endpoint表記の内部候補管理不整合で、外部wire形式の不一致ではない。 |
| 処理と異常系 | 合格 | Provider成功/失敗、空応答、不正候補、single-flight、close、切替rollbackを実装・テストで確認。 |
| テスト十分性 | 合格 | 88テスト成功。主要なProvider経路を検証し、IR-001の追加テスト不足はMinorとして記録。 |
| 変更範囲内の品質 | 合格 | 型検査・lint成功。IR-001以外に差分由来の具体的品質欠陥なし。 |

## Remaining Risks

- Provider候補が正しいSymbolチェーン・ネットワークに限定されることは、NodeProviderの責務とされているが、専用承認済み仕様での保証方法は未確認です。
- 実ノード環境での候補更新、長時間障害、Providerの遅延・空応答の運用挙動は未確認です。
- IR-001を未修正のまま同一endpointの表記違いを初期候補へ渡すと、接続枠の一部が重複接続になります。

## Final Decision

公開可能

候補補充の差分は確認可能な契約を満たし、Critical/Majorの欠陥はありません。IR-001は、Provider追加候補と初期候補でendpoint同一性の扱いが不統一なMinor指摘です。
