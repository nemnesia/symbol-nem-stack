# Review Gates

次の domain を、発見した release surface と composite release set に対して適用する。

1. **Target / release-set identification**: 公開対象、surface、release set、責任境界を一意に discovery できる。
2. **Public documentation consistency**: README、translation、package docs、CHANGELOG、release docs が public facts と契約を矛盾なく説明する。
3. **Package / crate metadata**: name、version、license、repository、publish 設定、依存分類、runtime metadata が実体と一致する。
4. **Public API / ABI / compatibility**: Rust、TypeScript、Node、WASM、C ABI の API、型、ownership、互換性が一致する。
5. **Distribution contents**: crate、npm package、native、WASM、C ABI archive に必要な物だけが含まれ、secret や不要な開発物がない。
6. **Platform / runtime support**: supported target、baseline、Node / browser routing、native fallback、failure path が証拠で裏付けられる。
7. **Security / secret handling**: secret handling、signing、export、security guarantee、fail-closed boundary が過剰記載や漏えいなく説明される。
8. **SBOM / license evidence**: SBOM、inventory、strict policy、unknown license、third-party license text、digest が検証可能である。
9. **Provenance / release identity**: OIDC / provenance が package、version、workflow、tag、source commit、environment に結び付く。
10. **Durable publication**: Actions artifact と durable release record を区別し、exact asset set、manifest、checksum を永続保存できる。
11. **Retry / recovery**: partial failure と rerun が二重 publish、version collision、evidence 不整合を起こさず fail closed に回復できる。
12. **Validation evidence**: 実行済み結果、未実行範囲、外部依存、full validation の根拠が事実どおり追跡できる。
13. **Public hygiene**: obsolete wording、placeholder、local path、private reference、誤った metadata / copyright、unsupported claim が公開面に残らない。

Critical / Major の blocker があれば `NOT READY`、阻害しない Minor だけなら
`READY WITH MINOR FIXES`、すべて合格なら `READY` とする。対象不明の場合だけ
`TARGET CONFIRMATION REQUIRED` とする。
