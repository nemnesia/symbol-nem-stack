---
name: release-readiness-review
description: 公開対象の Rust crate、npm package、Node native addon、WASM、C ABI と、それらを束ねる release evidence / workflow を、公開前に repository の実体と照合して確認する。publish、tag、source code の変更は行わない。
---

# Release Readiness Review

Rust crate、npm package、Node native addon、WASM、Native C ABI およびそれらを束ねる
composite release set が、現在の実装、公開契約、配布物、security boundary、release
operation と一致し、安全に公開できるかをレビューする。公開操作、tag、remote、registry、
source code の変更は行わない。

## 作業開始時に読む資料

1. `AGENTS.md`
2. `../review-common/review-playbook.md`
3. `reviewers.md`、`review-gates.md`、`output-format.md`
4. `agents/openai.yaml`
5. 対象 repository の manifest、README、LICENSE、CHANGELOG、変更差分
6. 対象に対応する仕様、設計、レビュー成果物、workflow、packaging / release script

対象 repository に存在しない固定 path や生成物を前提にせず、存在を確認した資料だけを
根拠として扱う。

## 対象と release set の確定

- crate、binding、package、artifact、README または release set が明示された場合は、その
  指定を優先する。
- ユーザーが repository-wide release readiness、production release、複数 distribution
  surface の公開前 review などを指定した場合は、Rust、npm、Node native addon、WASM、
  C ABI、release workflow、SBOM、provenance、release evidence を発見して一つの
  `composite release target` として扱う。単一 crate の選択を求めて終了しない。
- composite target では各 distribution surface を個別に確認し、別の責任境界や artifact
  を同一物として扱わない。
- 指定がなく候補が複数ある場合だけ自動選択せず、`TARGET CONFIRMATION REQUIRED` とする。
- package version、target 数、asset 数、package 名などは skill に固定せず、対象 repository
  の manifest、release manifest、workflow、証拠から発見して照合する。

## Release surface discovery

レビュー開始時に、対象 repository の構造から次を必要な範囲で discovery する。

- workspace / crate manifest、lockfile、`crates/**`、`packages/**`
- package manifest、workspace 設定、公開 API / declaration / header / WASM 定義
- root / package / translation README、LICENSE、CHANGELOG、public release docs
- `.github/workflows/**` と environment / permission / publish boundary
- packaging、release manifest、checksum、SBOM、license、provenance、release-record script
- archive、generated package、native addon、WASM、C ABI artifact とその検証 fixture

固定のディレクトリ名を必須条件にせず、発見した surface、生成手順、証拠、未確認範囲を
`Review Target` と `Scope and Traceability` に記録する。

## 確認範囲

対象確定後、次を発見した実体に対して確認する。

1. manifest、version、license、repository、description、依存関係、features、runtime
   条件、publish 設定
2. Rust API、TypeScript declarations、Node native addon、WASM export、C ABI header、
   ABI ownership、free API、buffer type
3. README、CHANGELOG、LICENSE、release docs、translation / package README の public fact
   と契約の整合
4. package / crate / archive の含有ファイル、secret、fixture、temporary data、不要な開発物
5. native / WASM routing、browser / bundler path、unsupported target、native failure path
6. C ABI の target、static / dynamic library、header compile、runtime smoke、baseline
7. release workflow、tag / source / version binding、OIDC、provenance、SBOM、license、
   durable release evidence、retry / recovery
8. public surface の obsolete wording、placeholder、local path、credential、誤った著作権、
   unsupported / deferred capability の過剰記載

## npm package review

公開 npm package が発見された場合、次を確認する。列挙した metadata は全 package に必須と
決めるものではなく、存在する値、必要な不足、repository との不一致を評価する。

### Identity / metadata

name、version、description、license、author、repository、homepage、bugs、keywords、
engines、publishConfig、files、type、main / module / types、exports を manifest と
`npm pack --dry-run` または既存 evidence に照合する。

### Public API / runtime

- runtime exports、TypeScript declarations、public subpaths、default export の有無
- sync / async contract、binary type、documented API、公開 API 数・名前の明示値
- native preferred path、WASM fallback、unsupported target、native load failure
- browser、bundler、package-local asset、remote download の有無

## 配布物、Native、WASM、C ABI

### npm contents

`npm pack --dry-run` または release evidence から expected / unexpected files を確認する。
source map、fixture、test data、development script、local path、credential、private key、
mnemonic、temporary data、native binary、WASM、README、LICENSE、package metadata を対象に
する。test fixture に意図的な test secret があること自体は blocker とせず、公開 tarball
または durable asset への混入を blocker とする。

### Native / C ABI

発見された C ABI または native distribution について、supported target、static / dynamic
library、public header、ABI ownership、free API、runtime smoke、archive inventory、LICENSE、
manifest、checksum、platform compatibility baseline を確認する。npm native addon と C ABI
を同じ artifact とみなさない。

### WASM

canonical WASM identity、generated glue、Node / browser path、bundler behavior、
package-local asset、remote download、integrity / manifest evidence、fallback contract を
確認する。

## Supply-chain / release operation

発見された release workflow と evidence に対して、次を正式な review domain とする。

- trigger、tag / source commit / version binding、protected environment、permissions、
  least privilege、publish boundary
- npm Trusted Publishing / OIDC、long-lived token fallback、provenance requirement、
  registry identity、package / version collision behavior
- SBOM format / identity、strict license policy、unknown license、third-party license text、
  digest binding
- Actions artifact と durable release record の区別、GitHub Release 等の durable publication、
  exact asset set、manifest、checksum、release-record
- npm publish success 後の durable publication failure、workflow rerun、二重 publish、
  version collision、evidence 不整合、recovery の fail-closed behavior

## Public hygiene と documentation consistency

README、package metadata、LICENSE、CHANGELOG、public header、public docs、release notes、
packed artifact、durable release artifact に対して、obsolete stage wording、placeholder、
TODO / FIXME の公開影響、temporary wording、local filesystem path、private repository/path、
internal instruction、credential、token、private key、mnemonic、sensitive sample、copyright、
author、version、public link、unsupported / deferred feature の誤記を確認する。

TODO / FIXME が source internal に存在するだけでは blocker とせず、公開内容・利用者契約・
release artifact への影響で評価する。

複数 README、root README、package README、translation、CHANGELOG、manifest、public API、
release docs の間で、package name、version、environment、target、install、import、API、
native / WASM、C ABI、chain / network、secret handling、signing、export、unsupported /
deferred feature、release status、security guarantee が利用者を誤認させないことを確認する。
文章の逐語一致は要求せず、public fact と contract の semantic parity を要求する。

## SemVer と validation

公開 Rust API、C ABI、WASM export、Wallet Store wire format、error contract、既定動作の
破壊は major、後方互換の機能追加は minor、内部実装・文書・test は patch 候補として、
対象 repository の version / tag policy と照合する。根拠が曖昧な場合は version を変更せず
未決定として記録する。

通常の validation は `AGENTS.md` の change-aware policy に従う。ただしこの review は
repository-wide release evidence と公開 gate を確認するため、コード差分がなくても gate
に必要な full validation を要求できる。その場合は「release gate のため実行した」と記録し、
未実行の registry、外部 node、target、compiler、長時間検証は成功扱いにしない。

## 境界、判定、成果物

- レビュー中は README、コード、manifest、仕様、設定、test、fixture、生成物、lockfile、
  remote、registry を変更しない。
- source、public API、製品仕様、release implementation の変更をレビュー指摘から直接
  実施しない。
- 判定は `READY`、`READY WITH MINOR FIXES`、`NOT READY`、`TARGET CONFIRMATION REQUIRED`。
  公開阻害事項は `NOT READY`、阻害しない Minor のみなら `READY WITH MINOR FIXES` とする。
- 成果物は共通 `output-format.md` の章構成を使い、composite target の発見結果、surface
  ごとの確認、evidence、未確認範囲、finding lifecycle、gate、残存リスクを追跡可能にする。
