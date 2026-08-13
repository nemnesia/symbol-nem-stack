# 実装から仕様書への改善依頼

- 対象仕様: `packages/symbol-event-stream` の公開契約（承認済み仕様書は未確認）
- 実装対象: `@nemnesia/symbol-event-stream` の候補ノード補充
- 作成日時: 2026-08-13T08:32:00+09:00
- 作成者: blockchain-implementer

## ES-NP-001: 候補枯渇時の NodeProvider 契約を仕様化する

- 分類: CRITICAL
- 該当箇所: 記載なし。既存レビュー `packages/symbol-event-stream/doc/reviews/implement-review.md` は候補補充を未決定事項としている
- 確認できた事実: 現行実装と公開READMEは固定 `nodewatchUrls` のみを候補集合とし、代替候補がない場合は現在の接続で再接続を継続する契約だった。実装依頼に基づき、EventStreamがpickerへ直接依存せず `() => Promise<string[]>` のNodeProviderから候補を取得する動作を追加した
- 未決定または矛盾: 承認済み仕様書に、Providerの存在、候補取得条件、候補の信頼境界、失敗時動作およびcloseとの競合に関する規定を確認できない
- 実装への影響: 公開型 `NodeProvider` と `nodeProvider` オプション、候補枯渇時の非同期補充、候補検証、single-flight、Provider失敗時の再接続継続を仕様と照合できない
- 仕様書作成者に求める決定: NodeProviderの型、呼出し条件、戻り値のendpoint制約、重複・使用中・blacklist候補の扱い、空配列・reject・不正候補のみの場合の動作、同時呼出しの統合、`close()`後の解決結果の扱いを仕様へ追加する
- 推奨案: `nodewatchUrls` は初期候補として後方互換で維持し、NodeProviderは任意の非同期callbackとする。候補枯渇時にsingle-flightで呼び出し、既存endpoint検証を通過した未使用・非blacklist候補だけを追加し、失敗時は現在の接続の再接続を継続する
- 暫定対応: あり。ユーザー承認済みの実装方針に基づき、`packages/symbol-event-stream/src/SymbolEventStreamTypes.ts`、`SymbolEventStream.ts`、`index.ts`、関連テストおよびREADMEへ実装した。仕様確定後に公開契約と実装を再照合する
- 検証条件: 仕様更新後、型定義・候補補充・失敗時動作・single-flight・close競合のテストが仕様の受け入れ条件と一致し、レビューで再確認できる
