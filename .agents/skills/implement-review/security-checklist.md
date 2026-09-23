# Implementation Security Checklist

この文書は、秘密鍵・Mnemonic を扱う Wallet Core の Implementation Review で、実装が上流で確立された security property、architecture、contract を安全に満たしているか確認するための詳細観点である。新しい製品要求、Requirement、Design、Specification、API、policy、暗号方式を定義しない。Security Reviewer は変更から protected asset と attack surface を特定し、対象に適用できる項目だけを確認する。全項目を機械的なチェックボックスとして適用・出力しない。

secret の copy、zeroization、constant-time、fuzzing、dependency の選択などは、それ自体を finding にしない。必要性、lifetime、消去可能性、具体的な leakage path、契約または既存 security invariant の破綻、asset impact、reachability を確認する。別の暗号ライブラリ、2FA、Hardware Wallet、一般論としての rate limit、実装スタイルの好み、threat model 外の hardening は、具体的な実装欠陥がない限り finding にしない。

## A. Protected asset mapping

今回の変更が扱う protected asset と、その所有者・利用者・境界を最初に特定する。対象例は次のとおり。

- Mnemonic、seed、private key、derived private key
- ephemeral signing secret、signing authority
- Profile password、KDF-derived key
- 復号済み Wallet Store payload

変更が protected asset に触れない場合は、不要な secret checklist を機械的に適用しない。asset の分類、機密性・完全性・認可への影響、Core / Native / WASM / Application の trust boundary を、Requirements / Design / Specification と実装へ追跡する。

## B. Secret lifecycle

secret の generation、restoration、import、derivation、unlock / activation、use、signing、temporary representation、persistence、replacement、deletion、failure path、Drop、restart / recovery を追跡する。

- secret が必要以上に長く生存していないか
- secret owner と使用権限が Design / Specification の責任分界に一致するか
- old state、pending state、new state の置換時に古い secret が残らないか
- early return、partial failure、panic / error、再起動・復旧時に安全側となるか

lifetime の短さや owner の形式だけを好みで要求せず、実際の保護対象、到達可能性、漏えいまたは不正利用への影響を確認する。

## C. Secret copies

secret の次のコピーと temporary representation を実装上で追跡する。

- `Clone`、`Copy`、`to_vec`、temporary array
- stack / heap allocation、serialization buffer、intermediate value
- FFI copy、WASM / JavaScript conversion、error construction

copy が存在するだけでは finding にしない。必要性、保持期間、消去可能性、さらにその copy が protected asset の leakage、lifetime、ownership、memory safety を悪化させる具体的な影響を確認する。

## D. Zeroization

対象 secret の owner、temporary buffer、derived secret、復号済み material、replacement 前後の値について、zeroization が必要な箇所と到達経路を確認する。

- normal Drop、early return、error path、partial failure、replacement path
- intermediate value、serialization buffer、temporary copy
- `zeroize` の適用対象、実際の ownership、全 copy の lifetime

`zeroize` crate を使っていることだけで PASS にしない。手動ゼロ書込みか既存 mechanism かという実装方式の好みだけでも finding にしない。必要な owner や copy が消去されず、秘密情報保護を破る具体的な影響がある場合に指摘する。

## E. Logging / diagnostics / panic leakage

正常系・失敗系・テスト失敗出力について、次の経路から secret、password、復号済み payload が露出しないことを確認する。

- `Debug`、`Display`、error、warning、panic、`assert!`
- tracing、logging、diagnostics、serialization error
- FFI / WASM の error conversion、test failure output

秘密情報を直接含める場合だけでなく、復元可能な表現、過剰な buffer dump、秘密を含む debug 表示も対象にする。診断の有用性を理由に秘密情報を追加公開する新しい policy は発明しない。

## F. Cryptographic primitive usage

対象に応じて、実際に呼び出される primitive とその組み合わせを Specification、Design、確認済みの公式・暗号資料と照合する。

- signature、hash、KDF、AEAD、key derivation、RNG
- nonce、salt、AAD、tag、key length、algorithm identifier、domain separation
- 入力 byte 列、出力 encoding、canonical bytes、key / nonce / salt の責任主体
- verification result、authentication result、generation failure、wrong password / tamper の error handling

primitive 名が正しいだけで PASS にせず、parameter、exact input bytes、encoding、認証結果の扱い、失敗時の state を確認する。AEAD authentication failure を無視する、nonce reuse が起きる、署名対象を暗黙に変換する等の concrete misuse は finding とする。

## G. Custom cryptographic arithmetic

暗号ライブラリの primitive を使わず、scalar arithmetic、finite-field arithmetic、modular reduction、signature arithmetic、byte-level modular arithmetic 等を独自実装している場合は、**明示的な高リスク review target** とする。

少なくとも次を確認する。

- mathematical correctness、modular reduction、overflow / underflow、carry / borrow
- canonical representation、edge value、malformed value、subgroup / order assumption（該当時）
- reference implementation、official / known vector、独立に導出した expected value
- differential testing、production logic と独立した oracle
- secret-dependent branch / loop / memory access、timing behavior

既存テストが通るだけでは十分としない。テストの expected value が production implementation と同じロジックを複製していないか確認する。correctness defect、重大な timing leakage、署名・鍵・数量・serialization の誤りへ到達する場合は、仕様に算術の防御手段が逐語的にないことだけを理由に見逃さない。

## H. Side-channel considerations

対象に応じて、secret-dependent branch、secret-dependent loop count、secret-dependent memory access、variable-time arithmetic、comparison、early exit、table lookup、compiler / library behavior を確認する。

「crypto だから全部 constant-time に書き換える」は finding にしない。具体的な secret-dependent leakage path、攻撃者が測定できる境界、到達可能性、asset impact、既存の緩和要因が確認できる場合だけ指摘する。

## I. RNG / entropy

generation、nonce、salt、key、seed に使われる entropy の経路を確認する。

- cryptographically secure RNG と generation failure の扱い
- seed / nonce の再利用、予測可能性、key generation
- deterministic test RNG と production RNG の分離
- OS API / library 選択が Specification / 実装の安全条件を満たすか

test-only deterministic RNG の production path 混入、乱数取得失敗を成功扱いすること、再利用による concrete cryptographic misuse は finding とする。OS API や library の好みだけで変更を要求しない。

## J. Signing implementation

実際の signing path について、Specification の契約と protocol fact を次の観点で照合する。

- exact signing bytes、canonicalization、serialization、signing domain / domain separation
- account / key selection、signing authority、signature encoding
- chain、network、wrong account、wrong chain、wrong network
- verification assumptions、replay、substitution、malformed payload

仕様と違う signing target、wrong account / chain / network signing、arbitrary signing、signature verification の誤りは concrete finding とする。Core / Application の責任分界を維持し、Application UI の新しい確認機能を要求しない。

## K. Wallet Store / cryptographic persistence

対象に Wallet Store または暗号化 persistence が含まれる場合、KDF、password、salt、nonce、AEAD、AAD、tag、ciphertext、serialization、migration、replacement を追跡する。

- wrong password、tampered ciphertext、corrupted blob、unknown version の結果
- deterministic / randomized portions、認証失敗の扱い
- decrypt / authentication failure 後に部分的 state が採用されないこと
- old Store、pending replacement、new Store、失敗時の atomic visible result
- 復号済み material の lifetime、zeroization、error / log leakage

復号途中の state を公開・保存・置換する、authentication failure を成功として扱う、部分 mutation が残る等、Specification の fail-closed / atomicity や既存 cryptographic safety condition を破る実装は finding とする。

## L. Attacker-controlled input / parser

Wallet Store blob、CBOR、imported secret、password、transaction data、Native input、WASM input、serialized transaction 等、attacker-controlled input の parser / decoder を対象にする。

- malformed、truncated、oversized、duplicate、invalid length
- unknown enum / field / version、non-canonical form、integer boundary
- allocation amplification、nesting、infinite / excessive loop
- panic、UB、DoS、state corruption、secret state の汚染

parser / decoder が対象範囲に含まれる場合は、production decoder を直接対象にする fuzzing の有無・範囲も確認する。fuzzing をすべての関数へ要求せず、attack surface、既存 contract、具体的 risk に対応付ける。

## M. Native C ABI

Native C ABI の変更では、Specification の ownership / lifetime contract と実装・caller の両方を確認する。

- null pointer、pointer validity、length、bounds、初期化
- ownership、allocation / free pairing、double-free、use-after-free、aliasing、lifetime
- output initialization、partial failure、secret buffer の返却・消去・解放
- panic crossing FFI、ABI compatibility、concurrency assumption

caller が簡単に破れる安全条件、Rust 側の前提と C 側契約の不一致、失敗時の未初期化出力や解放不整合は concrete finding とする。`unsafe` や FFI の存在だけでは finding にしない。

## N. WASM / JavaScript boundary

WASM binding の変更では、secret material と opaque data が boundary を越える実際の経路を確認する。

- secret の不要な output、browser-visible data、JS managed memory exposure
- `Uint8Array`、string conversion、copy semantics、temporary buffer
- error conversion、lifetime、Core / binding の責任分界

Specification が禁止する secret exposure、不要な secret copy、opaque data の意図しない解釈・公開を concrete finding とする。WASM binding に未承認の secret management、cryptographic meaning、UI policy を追加要求しない。

## O. Unsafe Rust

対象範囲に `unsafe` が存在する場合は必ず安全条件を確認する。

- pointer validity、bounds、aliasing、initialization、ownership、lifetime
- FFI assumptions、concurrency assumptions、caller が守るべき precondition
- safety comment / invariant が実装と一致し、実際に成立するか

`unsafe` が存在すること自体、または安全条件の説明が短いこと自体は finding ではない。安全条件が成立しない、説明できず caller が簡単に破れる、実装が条件を守っていない場合に memory safety / security impact を示して指摘する。

## P. Failure / replacement / atomicity

early return、error propagation、old state、pending state、new state、replacement Store、partial serialization、secret mutation 後の failure、persistence preparation 後の failure を追跡する。

Specification の fail-closed、transactional / atomic visible result、replacement contract と比較し、失敗後に旧 state と新 state が不整合になる、部分的な secret state が採用される、復号・認証前に state が更新される等の concrete defect を確認する。

## Q. Concurrency / synchronization

実装に並行性、共有 state、async task、thread、worker が存在する場合だけ適用する。

- race condition、shared secret state、lock scope
- stale state、use-after-lock、concurrent replacement / signing / deletion
- TOCTOU、Drop / zeroization と同時利用の相互作用

並行性がない対象へ一般的な synchronization 要求を追加しない。適用時は、具体的な race、stale authorization、secret lifetime、memory safety または atomicity への影響を示す。

## R. Dependency / feature interaction

変更対象に直接関連する場合だけ確認する。

- cryptographic / serialization dependency、zeroization behavior
- default / optional feature、WASM feature、Native-only path
- platform-specific backend、unsafe feature、version / API mismatch

特定 feature の有効化・無効化や platform path が、暗号、zeroization、parser、ABI、WASM、memory safety、互換性を具体的に変えるか確認する。単なる「最新版ではない」は finding にしない。

## S. Tests

Security-sensitive implementation に対して、対象に応じた positive / negative と境界を確認する。

- wrong password、wrong account、wrong chain、wrong network
- malformed、truncated、invalid length、unknown version、duplicate
- corrupted、tampered、invalid signature、authentication failure
- deterministic serialization、interop、secret lifecycle / failure path

テスト不足を finding とする場合は、未検出となる具体的な Critical / High defect、到達可能な attack surface、影響、必要な最小の検証を示す。全関数のテストや任意の coverage 数値を要求しない。

## T. Independent oracle / known vectors

暗号、serialization、protocol 処理では、可能な範囲で official vector、known vector、independent implementation、reference implementation、differential test を確認する。

特に custom cryptographic arithmetic、signing、derivation、address / key conversion、deterministic serialization、Symbol / NEM protocol encoding を優先する。expected value が production implementation と同じロジックから生成されているだけなら、独立 oracle とみなさない。

## U. Fuzzing

fuzzing が有効な attack surface では、存在、対象範囲、実行導線を確認する。候補は Wallet Store decoder、CBOR parser、Native input decoder、serialized transaction input などである。

- production decoder を直接対象としているか
- panic / crash だけでなく invariant violation、state corruption、resource abuse を検出できるか
- secret を corpus、log、failure output に記録しないか
- 対象範囲に含まれる場合、CI / 継続実行導線があるか

fuzzing がないことだけで finding にせず、parser の attack surface、具体的な未検出 defect、Requirements / Specification の検証可能性を根拠に採否を判断する。

## V. Differential testing

custom scalar arithmetic、signing、derivation、deterministic serialization、address / key conversion、Symbol / NEM protocol encoding 等の高リスク処理では、独立した実装・reference・known vector との differential testing を積極的に確認する。

production implementation と同じロジックを双方で使っている場合は独立検証にならない。differential test gap を finding とする場合は、重大な correctness / security defect を独立検出できない具体的な理由と影響を示す。

## W. Secret-bearing test data

tests、fixtures、fuzz corpus、snapshot、failure output、debug artifact に real mnemonic、real private key、production credential、user data が含まれないことを確認する。固定の公開 test vector、明示的にテスト専用の値、公開鍵や署名は区別する。

secret-bearing data の混入、ログ出力、CI artifact への漏えいは、秘密情報の機密性と到達可能性を根拠に finding とする。テストを再現可能にするための test-only secret を、production credential と同一視しない。

## X. Finding 採用条件

正式な Security finding は、少なくとも次を満たす。

1. 対象 Implementation、Specification、Design、Requirement、または確認済みの official protocol / cryptographic fact へ追跡できる。
2. 実際のコード、設定、生成物、テスト、fixture、fuzz corpus または実行結果に具体的事実がある。
3. confidentiality、integrity、authorization、cryptographic correctness、memory safety、interoperability、availability 等への影響を説明できる。
4. 現在の対象範囲と trust boundary に直接関係する。
5. 単なる好み、将来 hardening、未承認の policy、一般論ではない。
6. 完了条件または再確認方法を示せる。

## Y. Specification ambiguity との分離

実装が正しいか判断するための contract 自体が Specification に存在しない、または資料間で解消できない場合は、`Implementation defect` と断定しない。`Specification ambiguity`、`Specification gap`、`Implementation → Specification feedback` として分離し、欠けている決定、影響、追加確認を記録する。

ただし、private key / Mnemonic leakage、memory unsafety、nonce reuse、AEAD authentication bypass、明確に誤った署名計算、既存の primitive safety condition の破綻など、既存 security invariant または安全条件を具体的に破る defect は、Specification に防御方法が逐語的にないことだけを理由に見逃さない。上流への feedback が必要な場合も、`Implementation finding` と `Specification / Design feedback` を別項目にする。

Checklist 項目の存在だけでは finding、Severity、Gate を自動的に決めない。採用後は、CRITICAL / HIGH の New / Open / Reopened を Required Change として `REVISE IMPLEMENTATION` とし、MEDIUM / LOW のみを Optional / non-blocking として `READY` とできる、`review-gates.md` の policy を適用する。
