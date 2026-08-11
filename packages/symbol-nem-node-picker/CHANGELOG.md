# 変更履歴 / CHANGELOG

このプロジェクトにおけるすべての重要な変更は、このファイルに記録されます。  
/ All notable changes to this project will be documented in this file.

変更履歴のフォーマットは[変更履歴の管理](https://keepachangelog.com/en/1.0.0/)に基づいています。  
/ The changelog format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.2.0] - 2025/12/29

### 追加 / Added

- NodeWatch APIのフェイルオーバー処理を`@nemnesia/nodewatch-openapi-provider`パッケージに移行。  
  / Migrated NodeWatch API failover handling to `@nemnesia/nodewatch-openapi-provider` package.

## [1.1.0] - 2025/12/12

### 更新 / Changed

- nodewatchMainnetUrlsにフェイルオーバーを追加。  
  / Added failover to nodewatchMainnetUrls.
- リクエストタイムアウトを設定できるように変更。  
  / Changed to allow setting the request timeout.
- デフォルトのタイムアウト値を1000msから3000msに変更。  
  / Changed the default timeout value from 1000ms to 3000ms.

## [1.0.0] - 2025/12/06

### 追加 / Added

- 初期コードリリース。  
  / Initial code release.
