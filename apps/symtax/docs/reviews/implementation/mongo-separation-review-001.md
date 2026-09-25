# SymTax MongoDB分離 実装レビュー

## 対象

- **リポジトリ / ブランチ:** `nemnesia/symbol-nem-stack` / `feature/symtax`
- **確認日:** 2026-09-25
- **確認対象:** `apps/symtax`、現在のHEAD `5404bd2`までの実装
- **根拠資料:** `apps/symtax/docs/specification.md`、`design.md`、`requirements.md`、MongoDB公式接続文字列資料、対象コード・テスト
- **範囲:** MongoDB instance / URI / volume / credential / client / read-only / 起動・終了 / Compose / fail-closed / test coverage
- **未確認範囲:** 実Symbol Node MongoDBの権限・volume・lifecycle、実稼働環境の接続URI、独立したmongod同士の接続試験

## 指摘一覧

### MDB-001

- **Priority:** MEDIUM
- **File:** `apps/symtax/src/server/mongo/connections.ts`、`apps/symtax/src/app/page.tsx`
- **Lines:** `connections.ts:162-168`、`page.tsx:6-12`
- **Problem:** `connectConfiguredMongoStores()`は両MongoDB設定を検証して接続するが、アプリケーションから呼び出されていない。現在のApp RouterにはDB初期化処理がなく、ページはNetwork設定だけを読み込む。そのためSymTax URIまたはSymbol URIが未設定でもアプリ自体は起動し、DB構成の不足を起動時には検出しない。
- **Impact:** DB依存機能の起動前に設定不足・接続不能を検知する保証がなく、接続機能がアプリケーションへ接続されていない。現ページは履歴機能準備中の表示のみで、DB結果を成功扱いしてはいない。
- **Reason:** MongoDB分離作業の設定不足時fail-fast要件と、DesignのServer起動fail-closed責務。接続ヘルパー単体ではアプリケーションの起動条件を保証しない。
- **Recommended fix:** DB依存処理を有効にするruntime lifecycleまたはrequest boundaryから、両設定の検証と接続確立を一元的に所有させる。DB依存処理を提供する状態では、いずれかの設定不足・接続失敗を成功可能な状態として公開しない。履歴機能をまだ提供しない段階で起動時DB接続を必須にするかは運用要件に合わせて明示する。

### MDB-002

- **Priority:** MEDIUM
- **File:** `apps/symtax/src/server/mongo/connections.ts`
- **Lines:** `connections.ts:121-126,150-158`
- **Problem:** 成功後の`MongoConnectionSet.close()`は両clientを閉じるが、アプリケーション終了時にそれを呼ぶlifecycle ownerや`SIGINT` / `SIGTERM`処理は存在しない。現在はMongo接続ヘルパー自体が利用されていないため開いたclientはないが、DB依存処理へ接続した場合、終了経路は呼出側の手動管理に委ねられる。
- **Impact:** 将来の呼出側がcloseを忘れた場合、graceful shutdownやテスト・開発時の再起動で接続が適切に閉じられない。片側のstartup失敗時の相手側closeは実装されているが、通常終了時のアプリケーション統合は未成立。
- **Reason:** MongoDB分離作業で求められた二つのclientのshutdown管理、および起動・終了処理の責任。
- **Recommended fix:** Next.js server lifecycleまたはDB接続を所有するapplication serviceにclose責任を割り当て、SIGINT / SIGTERMとstartup途中の失敗経路を含めて検証する。Next.jsのsignal処理と衝突する独自handlerを無条件に追加せず、採用するserver lifecycleに沿って統合する。

### MDB-003

- **Priority:** MEDIUM
- **File:** `apps/symtax/src/server/mongo/config.ts`
- **Lines:** `config.ts:36-48`
- **Problem:** MongoDB接続文字列をWHATWG `URL` parserへ渡しているため、標準`mongodb://` URIの複数seed host形式（例: `host1:27017,host2:27017`）は`new URL()`で不正URLとなり`malformed`に拒否される。
- **Impact:** replica setやsharded cluster向けの標準複数host URIを両接続設定へ利用できない。SymTax Storeをstandaloneで運用し、Symbol Nodeも単一host URIである環境では影響しない。
- **Reason:** MongoDB公式の[標準接続文字列形式](https://www.mongodb.com/docs/v7.0/reference/connection-string-formats/)は`mongodb://host1[:port1][,...hostN[:portN]]`を認める。実装はdriverへ渡す前の検証でその標準形式を排除している。
- **Recommended fix:** MongoDB接続文字列の構文検証をMongoDB driverのURI parserに委譲するか、複数host形式を正しく扱える検証にする。接続先同一性の確認はURI文字列比較だけでなく、既存の接続後identity確認を維持する。

### MDB-004

- **Priority:** MEDIUM
- **File:** `apps/symtax/src/server/mongo/connections.test.ts`
- **Lines:** `connections.test.ts:46-139`
- **Problem:** MongoDB分離テストはclient factory、`hello`応答、close、read/write可能APIをmockした単体テストのみであり、実際の独立したmongod process / container二つを使うintegration testは存在しない。Symbol `find`の実読取、SymTax側の実insert、実認証権限、実process identityの応答は検証されていない。
- **Impact:** URIが意図した実instanceへ接続すること、SymTax書込みがSymbol DBへ現れないこと、Symbol read-only credentialが実際に拒否されることを自動試験で証明できない。
- **Reason:** `SPEC-STORE-001` / `CT-085`はinstance・credential・storage等の分離を適合確認する。既存unit testはAPI面を確認するが、二instance運用の実適合までは確認しない。
- **Recommended fix:** Docker daemonを使えるCIまたは開発環境に、別mongod process・別volumeの二instanceを用いるintegration手順を用意する。Symbol側read-only user、SymTax側write user、同一instanceを指定した場合の拒否、両clientのshutdownを実接続で確認する。

## チェック結果

| 項目 | 判定 | 根拠 |
|---|---|---|
| MongoDB instanceが完全に分離されている | **PASS（runtime guard） / 実環境未確認** | 起動時に`hello.topologyVersion.processId`を比較し、同一process・同一replica set・mongos・identity取得不能を拒否する。実配置の独立性は接続先環境では未確認 |
| volumeが分離されている | **PASS（SymTax Compose定義） / Symbol側未確認** | ComposeはSymTax専用named volumeのみを定義し、Symbol Node DBを管理しない |
| connection URIが分離されている | **PASS（設定検証）** | `SYMBOL_MONGO_URI` / `SYMTAX_MONGO_URI`を別々に必須化し、同一URI・正規化後同一URI・同一usernameを拒否 |
| Symbol MongoDBがread-only | **PASS（公開handle） / 実credential未確認** | Symbol側には`find`のみを公開。実DB userの権限は未接続のため確認できない |
| SymTax独自データがSymTax MongoDBのみに保存される | **PASS（接続API境界） / 実保存未確認** | write APIはSymTax側handleのみ。ただし永続repository / 実データ保存処理はまだ存在しない |
| 旧単一MongoDB設定へのfallbackがない | **PASS** | `MONGO_URI`等へのfallbackなし。config testも旧設定だけではmissingを返すことを確認 |
| 両MongoDB接続失敗時にfail-closed | **PASS（connection helper）** | Symbol / SymTaxごとに接続失敗を識別してthrow。片側失敗時は既接続clientを閉じる。App runtimeからの呼出しはMDB-001 |
| 両MongoDB clientがshutdown時にcloseされる | **FAIL（アプリ終了への統合なし）** | `close()`自体は両clientを閉じるがSIGINT / SIGTERM等から呼ばれない（MDB-002） |
| テストでも2インスタンス分離を検証している | **FAIL（mockのみ）** | 異なるprocess IDを模したunit testはあるが、実二instanceのintegration testはない（MDB-004） |

## Compose・設定・repository確認

- `apps/symtax/compose.yaml`は`symtax-mongo` serviceを一つ定義する。Symbol Node MongoDBは外部運用依存として意図的にComposeへ含めず、同じcontainerやdatabaseを共有していない。
- SymTax MongoDBは独立container、`symtax-mongo-data` named volume、loopback bindの`127.0.0.1:27018`、authentication、healthcheck、個別memory / CPU / WiredTiger cache設定を持つ。Host portはSymbol Nodeのdefault portとは競合しない。Compose内app serviceはないため`depends_on`はない。networkはCompose default networkを使い、restart policyは明示されていない（開発用DBでありSpecification上の必須条件ではない）。
- URI・database名は`SYMBOL_MONGO_*`と`SYMTAX_MONGO_*`へ分離され、旧単一URI fallbackはない。application usernameは別変数で、SymTax DBでは`readWrite` roleを作る。
- 現在のDB access codeは`connections.ts`だけであり、Symbol/SymTax repositoryやdomain collection accessはまだ存在しない。従って誤ったrepositoryへの接続先割当は確認されない。
- MongoDB接続エラーはStore別の安全な固定文言へ変換され、URIやcredentialをメッセージに含めない。
- READMEはSymbol DBを外部管理、SymTax DBをCompose管理と説明しており、volume / lifecycleの管理を混同していない。

## 検証結果

| 検証 | 結果 |
|---|---|
| `pnpm --filter @symbol-tools/symtax lint` | 成功 |
| `pnpm --filter @symbol-tools/symtax typecheck` | 成功 |
| `pnpm --filter @symbol-tools/symtax test` | 成功 — 11 files / 32 tests |
| `pnpm --filter @symbol-tools/symtax format:check` | 成功 |
| `pnpm --filter @symbol-tools/symtax build` | 成功 |
| `docker compose --env-file apps/symtax/.env.example -f apps/symtax/compose.yaml config --quiet` | 成功 |
| Docker実起動 / MongoDB integration | 未実施 — Docker clientはあるがdaemon socket `/var/run/docker.sock` へのアクセスがpermission denied |
| package integration test script | なし |

## 総合判定

MongoDBの設定・型上のread-only境界・Compose上のSymTax専用instance分離は概ね確認できた。運用環境そのものは提示されていないため、実Symbol DBとのinstance / volume / credential分離は確認していない。

**追加修正が必要:** はい — `MDB-001`、`MDB-002`、`MDB-003`。実二instance integration testの追加・実行も`MDB-004`として推奨する。
