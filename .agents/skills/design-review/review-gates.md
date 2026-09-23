# Review Gates

Gate を不合格にする finding は `Critical` の正式指摘へ対応付ける。`Critical` が1件以上存在する場合は `REVISE DESIGN`、`Critical` がなく `Major` / `Minor` のみの場合は `READY` とする。

Security の確認は独立した Gate を追加せず、既存 Gate へ対応付ける。secret owner が不明、trust boundary が成立していない、signing authority の責任主体が不明、Core / binding 間で secret responsibility が逆流している、failure model が安全側を保証できない、または security invariant を Specification へ引き渡せない根本欠陥は、影響と下流 blocking が確認できる場合に既存 Gate の `Critical` になり得る。checklist の項目だけで自動的に Gate failure や `Critical` にしてはならず、`Major` を自動的に Gate failure へ変更しない。

protected assets、trust boundaries、secret ownership、binding boundary は主に Gate 2 と 5、lifecycle、failure model、replacement、restart は Gate 4 と 5、authentication / authorization、signing authority、chain / network separation は Gate 6、security invariant と downstream handoff は Gate 6 と 8 へ対応付ける。実際の finding は影響と根拠に応じて一つ以上の既存 Gate に結び付ける。

1. 目的と範囲: 設計の目的、対象、対象外、前提が一意に理解できる。
2. コンテキストと責任: 外部主体、コンポーネント責務、trust boundary、秘密情報境界が明確である。
3. 依存方向: 依存が意図した方向に流れ、責務の逆流や循環がない。
4. 主要フロー: 正常、失敗、再試行、再起動、重複、結果対応の責任が確認できる。
5. データ所有: 状態、秘密情報、保持、更新、破棄の所有者と境界が明確である。
6. セキュリティと相互運用性: protected asset、secret lifecycle、authorization / signing authority、failure safety、security invariant、Symbol / NEM、Mainnet / Testnet、Core / Native / WASM の境界を弱めていない。
7. 上流整合性: 要件、仕様、既存設計と重大な矛盾がない。
8. 下流実装可能性: 下位仕様・実装・検証へ必要な設計判断を推測なしに引き渡せる。

API、schema、暗号パラメータなど下位工程の未決定だけでは Gate 不合格にしない。Gate 不合格に対応する Critical がない場合、Major / Minor のみを理由に差し戻さない。
