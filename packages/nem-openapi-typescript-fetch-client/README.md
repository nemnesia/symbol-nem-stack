# @nemnesia/nem-openapi-typescript-fetch-client

NEM NIS API（NEM1）のOpenAPI仕様から生成した、TypeScript製のFetchクライアントです。APIクラス、レスポンスモデル、FetchランタイムをESMパッケージとして提供します。

OpenAPI仕様の対象は、NEM NIS API Version 1.19（2017年3月20日）です。

## インストール

```sh
npm install @nemnesia/nem-openapi-typescript-fetch-client
```

Node.js `>=20.0.0`に対応しています。

## 使い方

```ts
import { Configuration, HeartbeatApi } from '@nemnesia/nem-openapi-typescript-fetch-client';

const configuration = new Configuration({
  basePath: 'https://t.nis1.rerena.nemnesia.com:7891',
});
const api = new HeartbeatApi(configuration);

const heartbeat = await api.getHeartbeat();
console.log(heartbeat);
```

`Configuration`を省略した場合は、生成時に設定されたTestnetノードが使用されます。接続先を変更する場合は`basePath`を指定してください。

```ts
const mainnetApi = new HeartbeatApi(
  new Configuration({
    basePath: 'https://sakia.nis1.harvestasya.com:7891',
  })
);

const localApi = new HeartbeatApi(
  new Configuration({
    basePath: 'http://127.0.0.1:7890',
  })
);
```

上記の接続先は、リポジトリに含まれる[`openapi-nem.yaml`](https://github.com/nemnesia/symbol-tools/blob/main/packages/nem-openapi-typescript-fetch-client/openapi-nem.yaml)の`servers`定義に基づいています。利用するノードの稼働状況やネットワークを確認したうえで使用してください。

## 公開API

APIクラスは次のとおりです。

- `AccountApi` — アカウント、保有モザイク、ネームスペース、送受信トランザクション
- `BlockApi` — ブロックの取得
- `ChainApi` — ブロックチェーンの高さ、スコア、最新ブロック
- `DebugApi` — NISノードのデバッグ情報
- `HeartbeatApi` — NISノードの応答確認
- `LocalApi` — ローカルAPI
- `NamespaceApi` — ネームスペースとモザイク定義
- `NodeApi` — ノード情報とピア情報
- `StatusApi` — NISノードのステータス
- `TransactionApi` — トランザクションのアナウンス

すべてのAPIクラスとモデルはパッケージのエントリポイントからexportされています。各メソッドの引数、戻り値、HTTPパスの詳細は、リポジトリ内の[生成済みAPIドキュメント](https://github.com/nemnesia/symbol-tools/tree/main/packages/nem-openapi-typescript-fetch-client/src/docs)および[`openapi-nem.yaml`](https://github.com/nemnesia/symbol-tools/blob/main/packages/nem-openapi-typescript-fetch-client/openapi-nem.yaml)を参照してください。

たとえば、パラメータを持つAPIはリクエストオブジェクトを渡して呼び出します。

```ts
import { AccountApi, Configuration } from '@nemnesia/nem-openapi-typescript-fetch-client';

const accountApi = new AccountApi(
  new Configuration({
    basePath: 'https://t.nis1.rerena.nemnesia.com:7891',
  })
);

const account = await accountApi.accountGetGet({
  address: 'TB7PINA6CP6RZT6N3ETEZRJZRPMSAJ3FHAPB4NI7',
});
console.log(account);
```

## 設定とエラー

`Configuration`では、接続先のほかに共通ヘッダー、Fetch実装、ミドルウェア、クエリ文字列化関数、`credentials`を指定できます。API呼び出しは標準の`fetch`を使用し、必要に応じて`fetchApi`で差し替えられます。

レスポンスが2xx以外の場合は`ResponseError`、Fetch自体に失敗した場合は`FetchError`が送出されます。ランタイムが提供するエラー型や設定型は、次のようにimportできます。

```ts
import { Configuration, FetchError, ResponseError } from '@nemnesia/nem-openapi-typescript-fetch-client';
```

秘密鍵などの機密情報をリクエスト、ログ、エラーメッセージに不用意に含めないでください。

## 開発

リポジトリのルートで依存関係をインストールしてから、対象パッケージを指定して実行します。

```sh
pnpm install
pnpm --filter @nemnesia/nem-openapi-typescript-fetch-client build
```

`openapi-nem.yaml`から生成コードを作り直す場合は、次を実行します。

```sh
pnpm --filter @nemnesia/nem-openapi-typescript-fetch-client gen
```

`gen`は`src`を再生成するため、生成済みファイルを手動で編集した内容は保持されません。

## ライセンス

このプロジェクトは[Apache License 2.0](./LICENSE)の下でライセンスされています。
