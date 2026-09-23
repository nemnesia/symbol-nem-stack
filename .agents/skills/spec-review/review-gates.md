# Review Gates

Gate を不合格にする finding は `Critical` の正式指摘へ対応付ける。`Critical` が1件以上存在する場合は `REVISE SPECIFICATION`、`Critical` がなく `Major` / `Minor` のみの場合は `READY` とする。

1. 目的と範囲: 要件を満たす対象、対象外、利用者、責任を一意に理解できる。
2. 契約: 入力、出力、データ、validation、error、状態、禁止事項を確認できる。
3. 処理と例外: 現在の範囲に必要な正常時、失敗時、境界、順序、状態結果を確認できる。
4. 内部整合性: 用語、要求、例、図表、関連資料に実装を妨げる矛盾がない。
5. 検証可能性: 既存要求の合否、境界、失敗を独立して検証できる。
6. 安全性と相互運用性: 適用される protected asset exposure、authentication / authorization、signing authority、signing target / canonical bytes、chain / network、cryptographic contract、nonce / salt / randomness、AAD / domain separation、Wallet Store / persistence、serialization、malformed / tampered input、fail-closed、atomic visible result、error、Native / WASM boundary、unknown / version、interoperability、security testability が外部から判定できる。
7. 上流整合性: コンセプト、要件、前段レビューのブロック判定や未解決 Critical と矛盾しない。

Security checklist の項目は独立した Gate ではなく、主に Gate 2（契約）、Gate 3（処理と例外）、Gate 5（検証可能性）、Gate 6（安全性と相互運用性）、Gate 7（上流整合性）へ対応付ける。チェック項目が存在することだけで不合格にはしない。

次のような根本欠陥は、既存 Gate の impact、ambiguity、downstream blocking に照らし、Critical になり得る。

- signing target / canonical bytes が一意でない
- chain / network binding が不明である
- secret を返してよいか、どの boundary を越えてよいか不明である
- cryptographic contract が合理的な実装間で分岐する
- tampered data の扱いまたは fail-closed contract が不明である
- Wallet Store の security-sensitive field / encoding が一意でない
- Native / WASM の ownership・length・error 境界が安全に実装できない

これは自動分類ではない。根拠、外部影響、実装・検証の阻害を確認して重大度を決める。Major を自動的に Gate failure へ変更しない。

上流資料やフィードバックがないことだけでは Gate 不合格にせず、未確認として記録する。Gate 不合格に対応する Critical がない場合、Major / Minor のみを理由に差し戻さない。
