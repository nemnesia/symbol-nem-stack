# @nemnesia/nodewatch-openapi-provider

SymbolおよびNEMブロックチェーンノード向けのフェイルオーバー対応NodeWatchサービスクライアントです。

## 特徴

- SymbolおよびNEMノードのフェイルオーバー対応
- [@nemnesia/nodewatch-openapi-typescript-fetch-client](https://www.npmjs.com/package/@nemnesia/nodewatch-openapi-typescript-fetch-client)の上に構築
- TypeScript対応

## インストール方法

```bash
npm install @nemnesia/nodewatch-openapi-provider @nemnesia/nodewatch-openapi-typescript-fetch-client
```

## 使い方

```typescript
import { createNemNodeWatchApi, createSymbolNodeWatchApi } from '@nemnesia/nodewatch-openapi-provider';

// SymbolノードAPIの作成
const symbolApi = createSymbolNodeWatchApi('mainnet');

// NEMノードAPIの作成
const nemApi = createNemNodeWatchApi('testnet');

// URLリストを利用者側で指定する場合
const customSymbolApi = createSymbolNodeWatchApi('mainnet', [
  'https://nodewatch.example.com',
  'https://nodewatch-backup.example.com',
]);
```

## E2Eテスト

E2Eテストは公開NodeWatchサービスへ接続し、Symbol/NEMおよびmainnet/testnetのAPI応答を確認します。
外部サービスが利用できない環境では、該当するテストスイートをスキップします。

```bash
pnpm --filter @nemnesia/nodewatch-openapi-provider test:e2e
```

## ライセンス

MIT
