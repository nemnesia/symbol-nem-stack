# Symbol/NEM Stack

Symbol および NEM ブロックチェーンのための TypeScript/JavaScript ツールとライブラリのモノレポです。

## パッケージ

このモノレポには以下のパッケージが含まれています:

### Packages

- **[symbol-sdk](./packages/symbol-sdk)**
  [![npm version](https://img.shields.io/npm/v/@nemnesia/symbol-sdk?style=flat-square)](https://www.npmjs.com/package/@nemnesia/symbol-sdk)  
   Node.js/ブラウザ両対応のSymbol公式SDK移植版。

- **[simple-password-crypto](./packages/simple-password-crypto)**
  [![npm version](https://img.shields.io/npm/v/@nemnesia/simple-password-crypto?style=flat-square)](https://www.npmjs.com/package/@nemnesia/simple-password-crypto)  
  Argon2id + AES-256-GCMによるパスワード暗号化ライブラリ。

- **[symbol-qr-library](./packages/symbol-qr-library)**
  [![npm version](https://img.shields.io/npm/v/@nemnesia/symbol-qr-library?style=flat-square)](https://www.npmjs.com/package/@nemnesia/symbol-qr-library)  
  Symbolブロックチェーン用のQRコードデータを生成・管理するTypeScriptライブラリ。

- **[symbol-nem-interchange-format](./packages/symbol-nem-interchange-format)**
  [![npm version](https://img.shields.io/npm/v/@nemnesia/snif?style=flat-square)](https://www.npmjs.com/package/@nemnesia/snif)  
  SymbolとNEMのデータを交換するSNIF（Symbol/NEM Interchange Format）ライブラリ。

- **[symbol-openapi-typescript-fetch-client](./packages/symbol-openapi-typescript-fetch-client)**
  [![npm version](https://img.shields.io/npm/v/@nemnesia/symbol-openapi-typescript-fetch-client?style=flat-square)](https://www.npmjs.com/package/@nemnesia/symbol-openapi-typescript-fetch-client)  
  Symbol REST APIのTypeScriptクライアント（OpenAPI自動生成）。

- **[nem-openapi-typescript-fetch-client](./packages/nem-openapi-typescript-fetch-client)**
  [![npm version](https://img.shields.io/npm/v/@nemnesia/nem-openapi-typescript-fetch-client?style=flat-square)](https://www.npmjs.com/package/@nemnesia/nem-openapi-typescript-fetch-client)  
  NEM NIS APIのTypeScriptクライアント（OpenAPI自動生成）。

- **[symbol-websocket](./packages/symbol-websocket)**
  [![npm version](https://img.shields.io/npm/v/@nemnesia/symbol-websocket?style=flat-square)](https://www.npmjs.com/package/@nemnesia/symbol-websocket)  
  SymbolブロックチェーンのWebSocketリアルタイム監視ライブラリ。

- **[symbol-event-stream](./packages/symbol-event-stream)**
  [![npm version](https://img.shields.io/npm/v/@nemnesia/symbol-event-stream?style=flat-square)](https://www.npmjs.com/package/@nemnesia/symbol-event-stream)  
  自動重複排除機能付きマルチ接続SymbolブロックチェーンWebSocketイベントストリーム。

- **[symbol-announcer](./packages/symbol-announcer)**
  [![npm version](https://img.shields.io/npm/v/@nemnesia/symbol-announcer?style=flat-square)](https://www.npmjs.com/package/@nemnesia/symbol-announcer)  
  Symbolトランザクションのアナウンス＆WebSocket監視ツール。

- **[nem-symbol-node-picker](./packages/nem-symbol-node-picker)**
  [![npm version](https://img.shields.io/npm/v/nem-symbol-node-picker?style=flat-square)](https://www.npmjs.com/package/nem-symbol-node-picker)  
  NodeWatch APIからNEM/Symbolノードをランダム取得するユーティリティ。

- **[nem-websocket](./packages/nem-websocket)**
  [![npm version](https://img.shields.io/npm/v/@nemnesia/nem-websocket?style=flat-square)](https://www.npmjs.com/package/@nemnesia/nem-websocket)  
  NEMブロックチェーンのWebSocketリアルタイム監視ライブラリ。

- **[nodewatch-openapi-provider](./packages/nodewatch-openapi-provider)**
  [![npm version](https://img.shields.io/npm/v/@nemnesia/nodewatch-openapi-provider?style=flat-square)](https://www.npmjs.com/package/@nemnesia/nodewatch-openapi-provider)  
  Symbol/NEMノードのフェイルオーバー対応NodeWatchサービスクライアント。

- **[nodewatch-openapi-typescript-fetch-client](./packages/nodewatch-openapi-typescript-fetch-client)**
  [![npm version](https://img.shields.io/npm/v/@nemnesia/nodewatch-openapi-typescript-fetch-client?style=flat-square)](https://www.npmjs.com/package/@nemnesia/nodewatch-openapi-typescript-fetch-client)  
  NodeWatch REST APIのTypeScriptクライアント（OpenAPI自動生成）。

### apps

- **[symbol-finalization-proof-viewer](./apps/symbol-finalization-proof-viewer)**  
  ノードのVoting Key有効期限・投票状況を可視化するWebアプリ。

## 前提条件

- Node.js 20.19.6
- pnpm 11.18.0

各パッケージの `engines` で指定されているNode.jsの最低バージョンは20.0.0です。

## セットアップ

```bash
# 依存関係のインストール
pnpm install
```

## 開発

このプロジェクトは pnpm ワークスペースを使用したモノレポ構成になっています。

### 利用可能なコマンド

```bash
# ビルド
pnpm build              # すべてのパッケージをビルド

# テスト
pnpm test               # すべてのパッケージのテストを実行
pnpm test:ui            # テストUIで実行
pnpm test:coverage      # カバレッジ付きでテストを実行

# コード品質
pnpm lint               # ESLintでコードをチェック
pnpm lint:fix           # ESLintで自動修正
pnpm format             # Prettierでフォーマット
pnpm format:check       # フォーマットをチェックのみ
pnpm typecheck          # TypeScript型チェック

# 開発
pnpm dev                # すべてのパッケージを開発モードで起動

# クリーンアップ
pnpm clean              # ビルド成果物とnode_modulesを削除
```

### コード品質ツール

- **ESLint** - コードの静的解析
- **Prettier** - コードフォーマット
- **TypeScript** - 型チェック
- **Vitest** - テストフレームワーク

### 個別パッケージの操作

各パッケージの詳細については、それぞれのパッケージディレクトリ内の README.md を参照してください。

## ライセンス

各パッケージのライセンスについては、それぞれのパッケージディレクトリ内の LICENSE ファイルを参照してください。

## 貢献

貢献を歓迎します。プルリクエストを送信する前に、コードスタイルガイドラインに従っていることを確認してください。
