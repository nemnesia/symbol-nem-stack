# @nemnesia/nodewatch-openapi-provider

SymbolとNEMのNodeWatch APIを、アプリケーションから扱いやすくするproviderです。

NodeWatchを利用するアプリケーションでは、次の処理をそれぞれ実装する必要があります。

- 接続先NodeWatchの障害時に、別のURLへ切り替える
- SymbolとNEMで利用するNodeWatch APIを使い分ける
- NodeWatchのノード一覧から、URIが空で利用できないノードを除外する

このproviderは、NodeWatchのURLリストを受け取り、これらの処理を共通化します。

## インストール

```bash
npm install @nemnesia/nodewatch-openapi-provider @nemnesia/nodewatch-openapi-typescript-fetch-client
```

## 使い方

ネットワークを表す引数はありません。利用するネットワークのNodeWatch URLリストを指定して、SymbolまたはNEM用のAPIを作成します。

```typescript
import { createNemNodeWatchApi, createSymbolNodeWatchApi } from '@nemnesia/nodewatch-openapi-provider';

const mainnetUrls = ['https://nodewatch.symbol.tools'];
const testnetUrls = ['https://nodewatch.symbol.tools/testnet'];

const symbolApi = createSymbolNodeWatchApi(mainnetUrls);
const nemApi = createNemNodeWatchApi(testnetUrls);

const height = await symbolApi.getSymbolHeight();
const nodes = await symbolApi.getSymbolPeerNodes({ limit: 10 });
const nemNodes = await nemApi.getNemNodes();

console.log({ height, nodes, nemNodes });
```

URLを複数指定すると、リクエストに失敗したとき次のURLへ切り替えます。URLリストは少なくとも1件必要です。指定したURLがmainnet用かtestnet用かは、利用者側で管理してください。

ノード一覧を取得した場合、`endpoint`が未指定、空文字列、または空白のみのノードはproviderが除外します。そのため、利用できないノードをアプリケーション側で毎回確認する必要はありません。

## 主なAPI

- `createSymbolNodeWatchApi(baseUrls)` — Symbol用NodeWatch APIを作成します。
- `createNemNodeWatchApi(baseUrls)` — NEM用NodeWatch APIを作成します。

作成したAPIでは、NodeWatch OpenAPI clientが提供するheight取得、ノード一覧取得などのメソッドを呼び出せます。

## 対応環境

- Node.js 20以降
- TypeScript

## E2Eテスト

E2Eテストは公開NodeWatchサービスへ接続し、Symbol/NEMおよびmainnet/testnetのAPI応答を確認します。外部サービスが利用できない環境では、該当するテストスイートをスキップします。

```bash
pnpm --filter @nemnesia/nodewatch-openapi-provider test:e2e
```

## ライセンス

MIT
