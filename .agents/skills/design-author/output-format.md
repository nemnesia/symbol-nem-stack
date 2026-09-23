# Design Output Format

`docs/design/` の基本設計書は、対象に不要な章を省いてよいが、次の順序を基準にする。

1. 目的、対象、対象外
2. 上流根拠と用語
3. システムコンテキストと trust boundary
4. コンポーネント責務と依存方向
5. データ所有、秘密情報境界、lifecycle
6. 主要フロー、失敗、atomicity、再試行・再起動
7. Symbol / NEM、Mainnet / Testnet、Core / Native / WASM の境界
8. 運用前提、resource、検証方針
9. 採用した設計判断と代替案
10. 未決定事項と仕様への引継ぎ
11. Traceability と参照資料

各判断には、根拠、影響、必要な見直し条件を付ける。API、wire format、暗号パラメータなどを設計で固定する場合は、上位仕様または承認済み資料への追跡を示す。

秘密情報、実運用 credential、復号済みデータを本文、図、例、fixture、ログへ含めない。
