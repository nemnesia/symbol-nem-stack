# Specification Security Checklist

この checklist は、秘密鍵・Mnemonic を扱う Wallet Core の Specification Review で、Design で確立された security invariant、責任境界、secret flow、authorization、failure model が、外部から判定可能・実装可能・検証可能な仕様契約へ落ちているかを確認するためのレビュー観点である。

checklist 自体は、新しい Requirement、Design Decision、security policy、cryptographic policy、threat または security invariant の根拠ではない。対象 Specification、承認済み Requirements / Design / Concept、適用可能な既存 Specification、ユーザー提供の正式資料、必要な公式 protocol / schema へ追跡できる観点だけを適用する。全項目を機械的に finding や成果物へ出力しない。

Specification Review で確認するのは、`what exact behavior / contract must be observed` である。Rust の具体的 function / module、clone / copy、stack / heap temporary、zeroization の実装、`unsafe`、pointer arithmetic、実際の library call、side-channel の具体実装、parser implementation、fuzz harness implementation、具体的 memory lifetime は Implementation Review へ委譲する。Design の owner、responsibility、trust boundary、lifecycle、allowed secret flow、authorization responsibility、failure responsibility、security invariant が不足しているため Specification が security architecture を推測する必要がある場合は、`upstream Design gap` として分離する。

## A. Protected asset exposure contract

対象 API / operation / boundary ごとに、次の protected asset を受け取ってよいか、返してよいか、永続化してよいか、外部へ露出してよいかが Specification から判定できるか確認する。

- Mnemonic
- private key
- derived secret
- Profile password
- decrypted Wallet Store material
- signing authority

Design で Core 外への露出を禁止している asset が、API / binding contract の input、output、error、warning、debug、opaque data、永続化結果に漏れていないか確認する。確認対象は公開契約であり、Implementation の memory copy や保持期間ではない。

## B. Authentication / authorization contract

Design で認証・認可が必要とされた operation について、次が仕様として判定可能か確認する。

- protected operation は何か
- 必要な authorization condition は何か
- authentication / authorization failure の外部結果は何か
- unauthorized operation が state を変更しないか
- signing-capable state の前提は何か
- delete / replace / restore 等の高権限操作の条件は何か

UI 方式、内部 token 方式、認証画面の設計は要求しない。仕様上の condition と失敗結果が一意であることを確認する。

## C. Account / signing authority contract

次の関係が一意に判定できるか確認する。

- 対象 Account
- 対応する Software Key / signing authority
- Account 選択の責任
- wrong account の error / state result
- unauthorized account の扱い
- signing operation の成功条件
- signing result と secret の boundary

既存 Design が secret を caller へ返さず署名結果だけ返す境界を定めている場合、Specification がその境界を壊していないか確認する。Design にない新しい signing policy は発明しない。

## D. Signing target / canonical bytes

署名対象に関して、別実装でも同じ署名結果を得られる程度に次が定義されているか確認する。

- signing target
- 正確な byte sequence
- canonicalization
- serialization
- signing domain / chain context
- transaction type
- Symbol / NEM の差異
- Mainnet / Testnet の差異

「transaction を署名する」のような、入力・変換・対象 byte 列が特定できない表現を許容しない。Implementation 内部の関数構造は確認対象外である。

## E. Chain / network binding

Specification 上で次の関係が混同されず、wrong chain / wrong network の外部結果が既存 Requirements / Design に沿って一意か確認する。

- Symbol / NEM
- Mainnet / Testnet
- Software Key の chain 固定
- Profile の network boundary
- Account
- signing context

対象に応じて、reject、error、state unchanged 等の観測可能な結果を確認する。具体的な内部 enum 表現は要求しない。

## F. Cryptographic contract

Requirements / Design / protocol constraint が Specification で具体方式を定めることを要求している場合、実装間で結果や安全性が分岐しないために必要な暗号契約が欠落していないか確認する。

- signature algorithm
- KDF
- AEAD
- hash
- key derivation
- cryptographic randomness requirement
- nonce
- salt
- AAD
- tag
- key length
- encoding
- deterministic / randomized behavior
- version / algorithm identifier

採用済みの Requirement、Design、対象 Specification、適用可能な既存 Specification、または公式 protocol / schema から具体化が必要と追跡できる場合に限って曖昧さを finding 候補にする。「別の方式が好み」「追加の hardening が望ましい」だけでは finding にしない。

## G. Nonce / salt / randomness contract

対象暗号方式に必要な場合、次が仕様として一意か確認する。

- nonce generation rule
- nonce reuse prohibition
- salt generation / size
- randomness requirement
- caller supplied / Core generated の責任
- encoding / persistence
- generation or validation failure の結果

具体的 RNG implementation や OS API は Implementation Review に委譲する。

## H. AAD / domain separation

AEAD、署名、導出等で context binding が必要な場合、既存根拠に基づき次が仕様上定義されているか確認する。

- AAD に含めるもの
- binding する identifier / version / context
- signing domain
- chain / network domain
- Wallet Store context

Requirements / Design に根拠がない domain separation を新規発明しない。必要性と具体的な binding が上流または protocol から委譲されている場合だけ確認する。

## I. Wallet Store / persistence contract

Wallet Store 等について、外部から次を判定できるか確認する。

- encrypted / plaintext boundary
- version
- required fields
- deterministic / non-deterministic portions
- authentication
- decode behavior
- unsupported version
- corrupted data
- wrong password
- tampered ciphertext
- unknown field
- unknown enum
- ordering
- migration
- replacement result

Design レベルの ownership、Core 外への公開範囲、replacement の責任を Specification が勝手に変更していないか確認する。保存結果の security-sensitive field と encoding が別実装で分岐しないことを確認する。

## J. Serialization / deterministic encoding

対象データについて、別実装でも同じ bytes / result を得られる程度に次が定義されているか確認する。

- field
- type
- key
- ordering
- canonical encoding
- byte order
- integer range
- fixed-length bytes
- optional / required
- duplicate
- unknown field
- unknown enum
- version
- normalization

hex 表現と raw byte 列、Symbol と NEM、Mainnet と Testnet、SDK object 表現と protocol / wire 表現を混同していないか確認する。serializer library の指定は要求しない。

## K. Malformed / attacker-controlled input

外部入力について、適用される範囲で次の挙動が一意か確認する。

- malformed
- truncated
- oversized
- duplicate
- unknown version
- unknown enum
- invalid length
- invalid encoding
- invalid signature
- replay / substitution
- corrupted ciphertext
- wrong password
- wrong chain / network

少なくとも必要な範囲で、`accept / reject`、error category、state change の有無、secret exposure の有無を判定できることを確認する。具体的 parser 実装や fuzz harness は Implementation Review に委譲する。

## L. Fail-closed behavior

Design の fail-closed invariant が Specification の外部結果へ落ちているか確認する。対象に応じて、失敗時に次が判定可能か確認する。

- signing を継続しない
- state を commit しない
- replacement Store を返さない、または返す条件を満たす
- secret を返さない
- partial success を成功扱いしない

対象 Requirements / Design にない rollback implementation や追加の failure policy は発明しない。

## M. Atomic visible result / replacement

更新・保存・replacement operation について、次が一意か確認する。

- 成功時に何が確定したとみなされるか
- 失敗時に何が外部から観測されるか
- old / new state の関係
- replacement blob の扱い
- partial internal operation が公開結果へ現れるかどうか

具体的な transaction algorithm、file operation、rollback implementation は Implementation Review に委譲する。

## N. Error contract

Security-sensitive failure について、caller が必要な区別と安全な結果を判定できるか確認する。

- authentication failure
- authorization failure
- invalid password
- tampering
- malformed input
- wrong chain / network
- unsupported version
- invalid signing request
- persistence failure

具体的 error code を Specification が定める責務なら、その値・分類・mapping の一意性を確認する。Design だけに根拠があり error code の具体値が Specification の対象外なら、勝手に新設しない。秘密情報を error、warning、debug、診断結果へ含める契約になっていないかも確認する。

## O. Native C ABI contract

Native C ABI が対象の場合、Specification 上で少なくとも次が判定可能か確認する。

- input / output ownership
- buffer ownership
- length
- caller / Core responsibility
- secret input / output allowance
- error result
- allocation / free contract
- opaque data treatment

具体的 pointer implementation、UB、double-free、pointer arithmetic の実装欠陥は Implementation Review に委譲する。ただし ownership contract 自体の曖昧さは Specification finding になり得る。

## P. WASM / JavaScript contract

WASM binding が対象の場合、Core と binding の責任分界を保ったうえで、次が必要な範囲で定義されているか確認する。

- JS へ公開してよい値
- secret を返してよいか
- Uint8Array / string 等の外部表現
- opaque data
- error mapping
- ownership / copy semantics として外部から必要な契約

JS heap 上の実際の secret lifetime、clone、zeroization、具体的 memory safety は Implementation Review の対象である。

## Q. Unknown / forward compatibility behavior

対象仕様に応じて、次の値の扱いが既存方針と一意に整合しているか確認する。

- unknown field
- unknown enum
- unsupported version
- future version
- reserved identifier

`ignore`、`preserve`、`reject`、`unsupported error` を区別する。将来互換性を一般論から新規追加しない。

## R. Interoperability

Symbol / NEM、Native / WASM、他実装との間で、同じ入力から同じ期待結果を得られる程度に次が具体化されているか確認する。

- encoding
- signature
- address
- public key
- chain / network interpretation
- Wallet Store decode / encode
- deterministic output

SDK の挙動だけを protocol / project Specification の根拠にしない。byte order、hex / raw bytes、network、chain、version の解釈が別実装で分岐しないか確認する。

## S. Security testability

Specification の security contract が、実装者と Reviewer が独立して適合性を確認できる粒度か確認する。必要に応じて次のような観測可能な検証条件が定義されているか確認する。

- known vector
- fixed vector
- negative condition
- tamper case
- deterministic expected bytes
- interoperability fixture

ここで確認するのは「何を検証すれば仕様適合か」の定義であり、unit test の実装、fuzz framework、test harness、fixture の生成方法を要求しない。

## 適用、finding、境界

適用した主要項目、適用外項目、未確認範囲は必要な場合だけ Review 成果物の `Domain Checks` 等へ記録する。次の全条件を満たす候補だけを正式 Security finding とする。

1. Requirements、Design、対象 Specification、適用可能な既存 Specification、Concept、ユーザー要求、ユーザー提供の正式資料または必要な公式 protocol / schema へ追跡できる。
2. Specification フェーズで一意な外部契約として定義すべき事項である。
3. Implementation だけでは互換性・安全性を一意に修正できない。
4. 現状の仕様のままだと、複数の合理的実装が異なる security behavior または wire behavior を持ち得る。
5. 具体的な input / output / state / error / cryptographic result / interoperability への影響を説明できる。
6. 必要な修正を内部実装方式へ固定せず表現できる。

次は Specification finding にしない。

- Rust type、library、zeroize crate、clone / allocation、stack temporary の好み
- `unsafe` の存在、具体的な pointer bug、parser implementation、fuzz framework
- secret が stack に残る、zeroize の Drop 漏れ、実際の memory lifetime
- side-channel の具体実装、RNG API の具体使用
- reviewer の好みだけに基づく暗号方式の変更
- 既存上流根拠のない新しい cryptographic policy、将来機能、一般的 hardening

これらは Implementation Review、未決定事項、upstream Design gap、または適用外として整理する。Checklist を根拠に新しい Requirement / Design / Specification policy を発明しない。
