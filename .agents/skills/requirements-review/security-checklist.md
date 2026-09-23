# Requirements Security Checklist

この checklist は、秘密鍵・Mnemonic を扱う Wallet Core の Requirements Review で、既存の Concept、ユーザー要求、Requirements、または製品が明示的に扱う protected asset / responsibility に対応する security property の欠落を確認するためのレビュー観点である。

checklist の項目は新しい security requirement を発明する根拠ではない。対象範囲に適用でき、既存の正式資料へ追跡できる項目だけを確認する。適用外の項目を無理に要求へ変換せず、必要な場合だけ適用外または未確認として記録する。

## A. Protected assets

Requirements 上で、製品が何を秘密情報・保護対象として扱うかを認識できるか確認する。

- Mnemonic
- private key
- derived secret
- Profile password
- decrypted Wallet Store material
- signing authority
- persisted encrypted wallet data

個々の保護対象の保存方式や暗号方式ではなく、対象と保護責任が明確かを確認する。

## B. Confidentiality

秘密情報について、必要な機密性の外部要求と公開範囲が明確か確認する。

- 不要な外部主体へ秘密情報を公開しないこと
- binding / Application へ不要な秘密情報を渡さないこと
- ログ、エラー、公開出力などへ秘密情報を露出しないこと
- 永続化時に平文秘密情報を許容するのか禁止するのか

「zeroize を使う」「AES-GCM を使う」などの方式は Requirements Review で決めない。

## C. Integrity

次の対象について、改ざん・置換・取り違えを安全に扱うための完全性要求が必要か確認する。

- 保存データの改ざん
- 秘密情報の置換
- Account / Software Key / Profile の関連付け
- signing target
- chain / network identification
- persisted state

具体的な MAC、AEAD、検査順序その他の方式は下流へ委譲する。

## D. Authentication / Authorization

秘密情報や signing capability を利用できる主体と、高権限操作の責任が Requirements 上で明確か確認する。

- 誰が秘密情報へアクセスできるか
- 誰が signing capability を利用できるか
- password / unlock 等の認証が必要な操作
- Account の選択と signing authority の責任分界
- delete / replace / restore 等の高権限操作

認証プロトコル、認証画面、UI 方式は決めない。

## E. Secret lifecycle requirements

秘密情報の要件レベルのライフサイクルと責任が、対象範囲に応じて定義されているか確認する。

- generation
- restoration
- import
- derivation
- use
- storage
- replacement
- deletion

特に Mnemonic を一時入力として扱うのか、Core が継続管理する対象なのかが曖昧でないことを確認する。詳細な state machine、memory 保持期間、消去方式は要求しない。

## F. Failure safety

失敗した場合に危険な状態へ進まず、既存の正常状態と秘密情報を保護する外部性質が必要か確認する。

- 認証失敗
- 復号失敗
- 改ざん検出
- 不正入力
- 保存失敗
- replacement 失敗
- signing failure
- chain / network mismatch

確認する性質は、失敗時に危険な状態へ進まないこと、既存の正常状態を不必要に破壊しないこと、秘密情報を露出しないことなどである。具体的な rollback algorithm は決めない。

## G. Trust / responsibility boundaries

既存の対象範囲に応じて、次の責任分界が Requirements 上で説明可能か確認する。

- Rust Core
- Native C ABI
- WASM binding
- Application / UI
- external node / service
- caller

特に、鍵管理、暗号処理、導出、署名、Account 選択、UI確認の責任が、意図しない別レイヤへ流れていないか確認する。Design レベルのコンポーネント構造や依存方向そのものは要求しない。

## H. Chain / network separation

対象に含まれる場合、次が混同されないという外部要求が存在するか確認する。

- Symbol / NEM
- Mainnet / Testnet

具体的な derivation path、network byte、serialization、protocol version の固定方法は Specification へ委譲する。

## I. Input / attacker boundary

外部から与えられるデータについて、malformed / tampered input を安全に拒否し、秘密情報や既存状態を危険にしないという性質が必要か確認する。

- Wallet Store blob
- imported secret
- password
- transaction data
- serialized input
- binding input

parser 方式、入力処理の詳細、fuzzing 方式は Requirements Review で決めない。

## J. Availability / resource safety

対象製品の明示された attack surface に必要な場合だけ、次の要件レベルの安全性を確認する。

- 不正入力による極端な resource consumption
- 永続状態の破壊
- 繰り返し失敗による不整合

一般論として DoS 対策を無条件に追加しない。対象範囲と具体的影響が確認できない場合は finding にしない。

## K. Recoverability

製品範囲に含まれる場合、backup、restore、recovery、corrupted state、deletion に関する必要な外部要求と責任分界があるか確認する。

具体的な backup format、recovery algorithm、データ復旧手順の実装方式は Requirements で決めない。

## L. Security responsibility / non-goals

既存 Concept / Requirements の対象範囲に基づき、次の責任と非目標が曖昧でないか確認する。

- Core が保証する範囲
- Application が保証する範囲
- caller responsibility
- OS / browser / host compromise など対象外とする threat
- user responsibility

既存資料から追跡できない新しい threat model を無制限に作らない。

## 適用と finding の採用

checklist の観点を適用した後、正式 finding として採用するのは、次のすべてを満たす候補に限る。

1. Concept、ユーザー要求、既存 Requirements、または製品が明示的に扱う protected asset / responsibility へ追跡できる。
2. Requirements フェーズで定義されるべき security property である。
3. 下流 Design / Specification / Implementation だけでは安全に解決できない。
4. 欠落により、異なる security property を持ち得る合理的な下流実装が生じる。
5. 具体的な外部影響または責任の不明確さを説明できる。

条件を満たさないものは、一般的 best practice、実装 hardening、詳細な memory safety 手法、特定アルゴリズム・ライブラリ、test technique、将来機能として finding にしない。Security Domain Check では、適用した観点だけを示し、全項目を機械的に出力しない。
