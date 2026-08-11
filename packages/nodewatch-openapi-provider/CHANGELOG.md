# 変更履歴

このプロジェクトにおけるすべての重要な変更は、このファイルに記録されます。

変更履歴のフォーマットは[変更履歴の管理](https://keepachangelog.com/ja/1.0.0/)に基づいています。

## [1.0.0] - 2026/08/11

### 変更

- `createSymbolNodeWatchApi`および`createNemNodeWatchApi`でNodeWatchのベースURLリストを必須指定に変更。
- ネットワーク指定とprovider内のデフォルトURLを削除。
- ノード一覧からURIが空または空白のみのノードを除外。

## [0.1.0] - 2025/12/29

### 追加

- 初期コードリリース。
- SymbolおよびNEMノード向けのフェイルオーバー対応NodeWatch APIクライアント。
- `createSymbolNodeWatchApi`および`createNemNodeWatchApi`関数を提供。
- 複数のNodeWatchエンドポイントへの自動フェイルオーバー機能。
