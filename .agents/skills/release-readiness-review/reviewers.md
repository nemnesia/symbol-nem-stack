# Reviewers

メインエージェントは Chair として、対象 release set、根拠、公開阻害事項、SemVer、判定、
成果物を担当する。composite release target では発見した各 distribution surface を別々に
確認し、4つの独立パスを維持する。サブエージェントを使わない場合は自己レビューの各観点を
実施し、実施していない起動や並列実行を記録しない。

## Reviewer A: Public contract / Documentation

README、translation parity、root / package README、CHANGELOG、public docs、LICENSE、
migration / release notes、公開 API、unsupported / deferred claims、security boundary を
確認する。利用者向け public fact と複数文書間の semantic parity を対象にする。

## Reviewer B: Metadata / Package / Artifact

Cargo / npm metadata、workspace、package inventory、npm tarball、Node addon、WASM、C ABI、
archive、header、manifest、checksum、不要ファイル、secret / credential の混入を確認する。
存在する surface と生成手順を discovery し、固定 path や asset 数を推測しない。

## Reviewer C: Version / Compatibility / Distribution contract

SemVer、Rust / TypeScript API、C ABI、WASM、Node runtime routing、Store / wire / error
compatibility、binary type、ownership、supported platform / environment、native / fallback
contract を照合する。npm native addon と C ABI、Symbol と NEM、Mainnet と Testnet を混同しない。

## Reviewer D: Validation / Supply chain / Release operation

CI、tests、fmt / clippy、WASM / Native validation、SBOM、license policy、third-party license
text、provenance、OIDC、release-record、durable GitHub Release、registry state、permissions、
partial failure、retry / recovery、publish boundary を確認する。未実行を成功扱いにしない。

## Chair の採用基準

公開した場合の具体的な利用不能、誤配布、互換性誤認、秘密情報同梱、重要な検証失敗、
provenance / durable evidence の欠落だけを公開阻害事項とする。任意の改善、coverage 数値、
将来機能、repository に存在しない surface の要求は blocker にしない。
