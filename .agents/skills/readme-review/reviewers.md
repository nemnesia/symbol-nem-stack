# Reviewers

README review は、複数ペルソナの討議を成果物へ出力しない。メインエージェントが Chair として、
対象 README / parity set、根拠、指摘、判定、成果物を担当する。Reviewer A〜C の独立パスを維持し、
parity mode では README 間の意味と公開契約を比較する。サブエージェントを使った場合だけ実行情報を記録する。

## Reviewer A: Factual / API accuracy

Cargo / npm manifest、workspace、Rust / TypeScript 公開 API、Node addon、WASM、C ABI header、
実装、仕様、テスト、sample と README の package / crate name、install、import、API、引数、戻り値、
環境、version、runtime routing、license を照合する。parity mode では共有する public facts の相違を確認する。

## Reviewer B: Onboarding / Examples / Links

概要、install、前提、最小例、設定、最初の実行までの導線、examples、links、relative reference、
root README と package README の役割分担を確認する。実行していない例を動作確認済みと書かず、翻訳の自然さではなく利用開始に必要な意味の一致を評価する。

## Reviewer C: Constraints / Security / Cross-language parity

未実装・future・deferred、chain / network、署名、Wallet Store、secret handling、Native / WASM ownership、
license、migration、release status、security boundary、過剰保証を確認する。JA / EN または root /
package README 間で capability、制約、supported environment、public API、native / WASM、C ABI、
unsupported feature、security warning が意味として一致することを確認する。

## Chair の採用基準

README の誤り、必要情報の不足、利用者を誤誘導する具体的な矛盾だけを採用する。見出し数、文章量、
逐語訳との差、API や製品を変更する提案、README の責務を越える実装改善は finding にしない。
