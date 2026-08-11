# NEM/Symbol Node Picker

[![npm version](https://badge.fury.io/js/nem-symbol-node-picker.svg)](https://badge.fury.io/js/nem-symbol-node-picker)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

NodeWatch API から NEM および Symbol ブロックチェーンノードをランダムに取得する軽量な Node.js およびブラウザ向けパッケージです。

NodeWatch APIからランダムなNEMおよびSymbolブロックチェーンノードを選択するための軽量Node.jsおよびブラウザパッケージ。  
A lightweight Node.js and browser package for picking random NEM and Symbol blockchain nodes from the NodeWatch API.

## 特徴 / Features

- 🚀 **高速/Fast**: 複数のNodeWatchエンドポイントへの同時リクエスト / Concurrent requests to multiple NodeWatch endpoints
- 💾 **キャッシュ機能/Cached**: API呼び出しを減らすための1分間のキャッシュ機能を内蔵 / Built-in 1-minute caching to reduce API calls
- 🛡️ **冗長性/Resilient**: NodeWatchインスタンス間の自動フェイルオーバー / Automatic failover between NodeWatch instances
- 🌐 **クロスプラットフォーム/Cross-Platform**: Node.js および ブラウザ で動作します / Works in Node.js and browsers
- 📦 **軽量/Lightweight**: 約3KB（圧縮・gzip化後） / ~3KB minified + gzipped
- 🔧 **TypeScript**: 完全なタイプサポートが含まれています / Full type support included

## インストール / Installation

```bash
npm install nem-symbol-node-picker
```

## 使い方 / Usage

### ES Modules (Node.js 20+)

```javascript
import { nemSymbolNodePicker } from 'nem-symbol-node-picker';

// Symbolメインネットから3つのランダムノードを取得 (HTTP/HTTPS)
// Get 3 random Symbol mainnet nodes (HTTP/HTTPS)
const symbolNodes = await nemSymbolNodePicker({
  chainName: 'symbol',
  network: 'mainnet',
  count: 3,
  isSsl: false,
});
console.log(symbolNodes);
// ['http://symbol-node-1.com:3000', 'https://symbol-node-2.com:3001', ...]

// SSL専用のSymbolテストネットノードを1つ取得
// Get 1 SSL-only Symbol testnet node
const sslNode = await nemSymbolNodePicker({
  chainName: 'symbol',
  network: 'testnet',
  count: 1,
  isSsl: true,
});
console.log(sslNode);
// ['https://testnet-symbol-node.com:3001']

// NEMメインネットノードを取得
// Get NEM mainnet nodes
const nemNodes = await nemSymbolNodePicker({
  chainName: 'nem',
  network: 'mainnet',
  count: 2,
  isSsl: false,
});
console.log(nemNodes);
```

### CommonJS (Node.js)

```javascript
const { nemSymbolNodePicker } = require('nem-symbol-node-picker');

async function getNodes() {
  const nodes = await nemSymbolNodePicker({ chainName: 'symbol', network: 'mainnet', count: 1 });
  console.log(nodes);
}
```

### ブラウザ (CDN) / Browser (CDN)

```html
<script type="module">
  import { nemSymbolNodePicker } from 'https://cdn.jsdelivr.net/npm/nem-symbol-node-picker/dist/browser/nem-symbol-node-picker.es.min.js';

  const nodes = await nemSymbolNodePicker({ chainName: 'symbol', network: 'mainnet', count: 1 });
  console.log(nodes);
</script>
```

## API

### `nemSymbolNodePicker(options)`

**パラメータ / Parameters:**

- `options` (object, 省略可/optional): オプション設定 / Options object (all optional)
  - `chainName` (string): チェーン名 - `'nem'` または `'symbol'`。デフォルト: `'symbol'` / Chain name - `'nem'` or `'symbol'`. Default: `'symbol'`
  - `network` (string): ネットワーク - `'mainnet'` または `'testnet'`。デフォルト: `'mainnet'` / Network - `'mainnet'` or `'testnet'`. Default: `'mainnet'`
  - `count` (number): 取得するノード数。デフォルト: `1` / Number of nodes to return. Default: `1`
  - `isSsl` (boolean): HTTPSエンドポイントのみ取得するか。デフォルト: `false` / Return only HTTPS endpoints. Default: `false`
  - `timeoutMs` (number): タイムアウト時間（ミリ秒）。デフォルト: `3000` / Timeout in milliseconds. Default: `3000`

- `Promise<string[]>`: ノードエンドポイントURLの配列 / Array of node endpoint URLs

**例外 / Throws:**

- `Error`: NodeWatchインスタンスが利用できない場合 / When no NodeWatch instances are available
- `Error`: 条件に合うノードがない場合（`No nodes match the requested criteria`） / When no nodes meet the criteria
- `Error`: リクエストタイムアウトが発生した場合 / When request timeout occurs

## 使用例 / Examples

```javascript
import { nemSymbolNodePicker } from 'nem-symbol-node-picker';

// 基本的な使用方法 - Symbolメインネットノードを1つ取得
// Basic usage - get 1 Symbol mainnet node
const nodes = await nemSymbolNodePicker();

// SSL専用ノードを複数取得
// Get multiple SSL-only nodes
const sslNodes = await nemSymbolNodePicker({ chainName: 'symbol', network: 'mainnet', count: 5, isSsl: true });

// テストネットNEMノードを取得
// Get testnet NEM nodes
const testnetNodes = await nemSymbolNodePicker({ chainName: 'nem', network: 'testnet', count: 3 });

// エラーハンドリング
// Error handling
try {
  const nodes = await nemSymbolNodePicker({ chainName: 'symbol', network: 'mainnet', count: 10 });
  console.log('利用可能なノード:', nodes); // Available nodes
} catch (error) {
  console.error('ノードの取得に失敗:', error.message); // Failed to get nodes
}
```

## NodeWatch API

このパッケージは [NodeWatch API](https://nodewatch.symbol.tools/api/openapi) を使用してノード情報を取得します。  
This package uses the [NodeWatch API](https://nodewatch.symbol.tools/api/openapi) to fetch node information.

**対応NodeWatchインスタンス / Supported NodeWatch instances:**

- メインネット / Mainnet:
  - `https://sse.nemnesia.com`
  - `https://sse2.nemnesia.com`
- テストネット / Testnet:
  - `https://testnet.sse.nemnesia.com`
  - `https://testnet.sse2.nemnesia.com`

`nodewatchMainnetUrls`および`nodewatchTestnetUrls`もexportされます。NodeWatchのheightとNode一覧を取得する場合は、`@nemnesia/nodewatch-openapi-provider`のsnapshot APIへこれらのURLリストを渡してください。

## キャッシュ機能 / Caching

パッケージには1分間の内蔵キャッシュが含まれており、以下の効果があります：  
The package includes built-in caching with a 1-minute duration to:

- NodeWatchインスタンスへのAPI負荷を軽減 / Reduce API load on NodeWatch instances
- 後続の呼び出しでレスポンス時間を改善 / Improve response times for subsequent calls
- キャッシュ期間内でのデータ一貫性を維持 / Maintain consistency within the cache window

## ライセンス / License

MIT ライセンスの下でライセンスされています。詳細は [LICENSE](./LICENSE) を参照してください。  
Licensed under the MIT License. See [LICENSE](./LICENSE) for details.
