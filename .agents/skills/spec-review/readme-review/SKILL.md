---
name: readme-review
description: root、package、translation などの README を、manifest、公開 API、実装、仕様、テスト、license と照合し、正確性、利用可能性、制約、security、複数文書の semantic parity をレビューする。コードや仕様は変更しない。
---

# README Review

README を利用者向け文書としてレビューし、インストールから最初の利用まで進められ、
記載内容を現在の実装と公開契約が裏付けているかを判定する。単一 README の従来 mode と、
複数 README / root と package README / translation の parity mode を提供する。

## 作業開始時に読む資料

1. `AGENTS.md`
2. `../review-common/review-playbook.md`
3. `reviewers.md`
4. `review-gates.md`
5. `output-format.md`

README のレビュー中は、対象 README と存在を確認した manifest、公開 API、仕様、実装、
テスト、sample、build script、license、関連 release docs だけを必要な範囲で参照する。

## 対象と mode

- ユーザーが README の path を1件指定した場合は single README mode としてその1件を対象にする。
- ユーザーが複数 README、README parity、日英 README、root と package README、release README
  parity などを指定した場合は、指定された集合を一つの `README parity target` として扱う。
  複数であることだけを理由に対象確認で終了しない。
- crate、binding、package、機能が指定され README path がない場合は直接対応する README を
  repository の構造から discovery する。候補が複数で指定もない場合だけ対象確認を求める。
- 未指定の場合は root README を対象にする。
- 成果物は `docs/reviews/readme/<READMEベース名>-review-NNN.md` に新規作成し、既存成果物を
  上書きしない。正式 finding ID は `RM` 接頭辞で base name ごとに連番にする。

## Canonical README と translation

一方の README が `canonical`、`authoritative`、`primary` と明示されている場合は、その README
を factual baseline とする。明示がなければ一方を勝手に canonical とせず、共有する public
fact と契約を各資料、manifest、実装、仕様、テストから照合する。

translation README は逐語訳である必要はない。次の semantic / contractual parity を要求する。

- 同じ capability、制約、supported environment、security boundary
- 同じ public API、install / import、引数、戻り値、binary type
- 同じ native / WASM / browser / C ABI の責任境界と release status
- 同じ unsupported / future / deferred feature、license、security warning、links

見出し数、文章量、例の順番、表現の自然さだけを finding にせず、意味の差を finding にする。

## 確認する事実源

README 全体を読んだ後、Cargo / npm manifest、workspace、Rust 公開 API、TypeScript declaration、
Node native addon、WASM 定義、C ABI header、主要実装、仕様、license、テスト、sample、build /
packaging script を必要な範囲で照合する。確認できない環境や未実行 sample は成功扱いにしない。

root README と package-local README は役割が異なってよい。例えば repository / architecture
overview と npm consumer guide を分担してもよいが、両方が触れる package name、version、install、
API、runtime routing、security、unsupported feature などの public contract は矛盾してはならない。

## レビュー観点

### Documentation / onboarding

- 概要、install command、package / crate name、import、Node / browser 前提
- 最小例、引数、戻り値、設定、最初の実行までの導線
- links、license、README 内外の relative reference、翻訳間の対応

### Public contract / runtime

- runtime exports、TypeScript declarations、public subpaths、default export、sync / async
- binary type、Wallet Store、署名、秘密情報 export、announce 非対応
- native preferred path、WASM fallback、unsupported target、native failure、browser / bundler
- C ABI の availability と npm package との責任境界

### Constraints / security / release status

- Symbol / NEM、chain / network、Mainnet / Testnet の区別
- secret handling、signing approval、ownership、保証範囲
- 未実装、future、deferred、bootstrap、production release status
- obsolete stage wording、placeholder、temporary wording、local path、private reference、
  credential、token、private key、mnemonic、sensitive sample、誤った metadata / copyright
- TODO / FIXME は source internal の存在だけで blocker とせず、公開内容・利用者契約への影響で評価する

## 実行と判定

`../review-common/review-playbook.md` の Phase 0〜3 を適用する。Reviewer A〜C の独立パスで、
single mode では対象 README、parity mode では各 README と共有 public contract を確認し、指摘を
反証してから gate を適用する。README、コード、manifest、仕様、設定をレビュー中に変更しない。

判定は `READY`、`READY WITH MINOR FIXES`、`REVISE README` とする。`ERROR` または `WARN` が
あれば `REVISE README`、`NIT` だけなら `READY WITH MINOR FIXES`、指摘がなければ `READY` とする。

## 作業完了後の Git 運用

`../review-common/review-playbook.md` の「成果物と Git」を適用する。
