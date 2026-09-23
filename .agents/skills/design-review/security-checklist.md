# Design Security Checklist

この checklist は、秘密鍵・Mnemonic を扱う Wallet Core の Design Review で、既存の Concept、Requirements、対象 Design、既存の適用可能な Design Decision、またはユーザー要求に追跡できる security architecture の欠落を探索するためのレビュー観点である。

checklist 自体は、新しい Requirement、Design Decision、threat、security goal または security invariant の根拠ではない。対象へ適用できる観点だけを確認し、全項目を機械的に成果物や finding へ変換しない。Design で確認するのは責任、所有、境界、lifecycle、依存方向、失敗責任および invariant であり、具体的な API、wire format、暗号方式、パラメータ、ライブラリ、実装方法は下流へ委譲する。

## A. Protected assets and security goals

Design が実際に扱う protected asset を既存資料から識別できるか確認する。

- Mnemonic
- private key
- derived private key / secret
- Profile password
- decrypted Wallet Store material
- encrypted Wallet Store
- signing authority
- Account association
- pending / replacement state

各 asset について、Design から必要な `confidentiality`、`integrity`、`availability / recoverability`、`authorization` の範囲と責任を追跡できるか確認する。Requirements にない新しい security goal を checklist から追加しない。

## B. Trust boundaries

次の境界を対象範囲に応じて識別し、何が越えるか、secret を越してよいか、opaque data として扱うか、validation / ownership / failure の責任がどちら側にあるかを Design から判断できるか確認する。

- Rust Core
- Native C ABI
- WASM binding
- Application / UI
- caller
- persistent storage
- external node / service
- host OS / browser environment

具体的な field、ABI、serialization を要求せず、secret exposure boundary と trust transition の責任だけを確認する。

## C. Secret ownership

次の秘密情報ごとに、誰が生成、保持、使用、破棄を担い、どこへ渡してよいかが明確か確認する。

- Mnemonic
- Software Key / private key
- Profile password
- derived secret
- decrypted Wallet Store

Core / Native / WASM / Application 間で、binding や Application が Core の secret ownership を代替したり、下位層の責任が上位へ逆流したりしていないか確認する。

## D. Secret lifecycle architecture

次の lifecycle が、各段階の owner、secret exposure、遷移責任、失敗責任を一貫して接続できるか確認する。

- generation
- restoration
- import
- derivation
- activation / unlock
- use
- signing
- persistence
- replacement
- deletion
- failure
- restart / recovery

詳細な state machine、memory 保持期間、消去方式は要求しない。各段階の責任と、失敗時にどの owner が安全な状態を保つかを確認する。

## E. Authentication / authorization architecture

Design 上で、次の操作と権限境界の責任主体が明確か確認する。

- secret-access capable operation
- signing-capable state
- account authorization
- user / caller approval boundary
- delete / replace / restore の権限
- unlock / lock responsibility
- Application が選択する Account と Core が扱う signing authority の関係

password protocol、token、UI 画面、API 形式は決めない。誰が authorization を判断し、誰が実行可能な状態を管理するかを確認する。

## F. Signing authority and signing boundary

Design 上で、signing request を作る主体、Account を選択する主体、signing authority を保有する主体、signing operation を実行する主体が明確か確認する。

- Core 外へ private key を出す必要性と許可範囲
- wrong account / wrong chain / wrong network を防ぐ責任
- signing 前確認など上位 Application の責任との境界

UI の具体的な表示や確認画面は Design finding にしない。signing authority の責任と境界が一意に引き渡せるかを確認する。

## G. Failure model / fail-closed

次の失敗ごとに、誰が検出し、誰が state を変更しない責任を持ち、既存の正常状態をどう保護し、secret exposure を増やさないかが Design から追跡できるか確認する。

- authentication failure
- decryption failure
- tampered Wallet Store
- malformed input
- invalid chain / network
- derivation failure
- signing failure
- persistence failure
- replacement failure
- delete failure
- binding conversion failure
- restart / partial state

具体的な rollback algorithm、error code、parser 実装は要求しない。安全側に終了できる責任構造と、失敗後の owner を確認する。

## H. Atomicity / replacement / state consistency

Wallet Store、Profile その他の更新について、次の関係を Design 上で一貫して説明できるか確認する。

- old state
- new state
- pending / temporary state
- replacement result

partial update を正常状態として外部へ見せない、replacement failure で既存正常状態を不必要に破壊しない、secret と metadata が片側だけ更新されない、owner が一意である、という責任と invariant が明確かを確認する。具体的な transaction algorithm や file operation は下流へ委譲する。

## I. Binding boundary

Native C ABI / WASM binding が、Core の次の意味と責任を奪っていないか確認する。

- cryptographic decision
- key management
- derivation meaning
- signing meaning
- Wallet Store internal interpretation

Binding は原則として `boundary conversion`、`transport`、`type conversion`、`ownership transfer`、`error mapping` を担い、秘密情報管理や暗号意味判断を独自に実装しない構造か確認する。Requirements / 既存 Design が異なる責任を明示する場合は、正式根拠を優先する。

## J. Opaque data boundary

Wallet Store / Pending Profile 等を opaque byte sequence とする既存方針が対象に適用される場合、binding、Application、caller が内部意味を解釈・編集する責任を持っていないか確認する。

具体的な serialization format を Design Review で決めない。opaque data の所有、移送、保存、失敗時の責任境界だけを確認する。

## K. Attacker-controlled input boundary

次の入力がどの trust boundary から入り、どこで validation / parser / decoder を担い、どこで trust transition し、失敗時に誰が責任を持つかが明確か確認する。

- Wallet Store blob
- password
- imported secret
- transaction / signing payload
- binding input
- serialized data
- external node result

具体的な parser implementation、fuzz technique、入力 field は要求しない。入力が秘密情報や既存状態を危険にする前の責任境界を確認する。

## L. Chain / network separation

Design が、責任・状態・signing authority の観点で次を暗黙に共通化していないか確認する。

- Symbol / NEM
- Mainnet / Testnet
- same key / different network
- chain-fixed Software Key
- Profile network boundary
- Account selection
- signing context

具体的な derivation path、network byte、serialization rule は下流へ委譲する。既存 Requirements / Design に存在する chain、network、Profile、Account の境界と責任を追跡する。

## M. Dependency direction

次の依存方向が security boundary と責任所有を維持しているか確認する。

```text
Application / Binding
        ↓
       Core
```

- Core が UI / browser / platform-specific policy に依存していない
- binding が Core の secret ownership を代替していない
- Application が cryptographic state の正本になっていない
- 循環依存や責任逆流がない

既存 Design が別の正式な依存方向を定めている場合は、その根拠と整合するかを確認する。

## N. Security invariants

Design 全体で維持すべき invariant が、既存 Requirements / Design へ追跡でき、Specification へ引き渡せるか確認する。

適用対象の例:

- private key / Mnemonic の ownership
- Core 外への露出禁止
- signing-capable operation の条件
- authorization boundary
- encrypted-at-rest property
- tampered state rejection
- chain / network separation
- fail-closed property
- binding non-authority

例示された invariant を checklist から新規に発明しない。対象資料に根拠がない場合は、finding ではなく未決定または未確認として扱う。

## O. Downstream handoff

Design で決めるべき security architecture が、Specification で一意な契約へ落とせる状態か確認する。

次の責任が Design に不足し、Specification が security architecture を推測しなければならない状態を確認する。

- owner
- responsibility
- trust boundary
- allowed secret flow
- authorization responsibility
- lifecycle responsibility
- failure responsibility
- chain / network responsibility
- security invariant

一方、API field、wire format、KDF、AEAD、nonce、error code の未決定だけでは Design defect にしない。Design の責任・境界・invariant が定まり、下流へ委譲されているかを確認する。

## Threat model の範囲

attack surface は Concept、Requirements、対象 Design、明示された protected asset、明示された trust boundary またはユーザー要求から合理的に追跡できるものに限定する。たとえば attacker-controlled Wallet Store blob のように既存境界上で明確な入力は確認対象にできるが、既存範囲で対象外の host OS compromise を防ぐ要求へ拡張しない。

## Finding の採用条件

checklist の項目があるだけでは finding にしない。正式 Security finding は、少なくとも次のすべてを満たす場合に限る。

1. Requirements / Concept / 対象 Design / 既存の適用可能な Design Decision / ユーザー要求へ追跡できる。
2. Design で決定すべき responsibility、ownership、trust boundary、lifecycle、authorization boundary、failure responsibility または invariant の問題である。
3. Specification / Implementation だけでは安全に修正できない。
4. 現状の Design のままだと、複数の合理的な下流実装が異なる security architecture を持ち得る。
5. 具体的な asset、trust boundary、failure、authorization への影響を説明できる。
6. 必要な修正を API、algorithm、library、wire format 等の下流方式に固定せず表現できる。

次は Design finding にしない。

- 特定の暗号アルゴリズム、KDF / AEAD、nonce / salt / tag、key length の要求
- zeroize crate、Rust type、clone / allocation / stack temporary、unsafe の具体的要求
- 具体的な ABI 関数、WASM export、API field、error code、wire format
- UI 確認画面、fuzz test、unit test case、一般的 hardening
- 将来機能や、既存資料に追跡できない新しい threat / security goal
