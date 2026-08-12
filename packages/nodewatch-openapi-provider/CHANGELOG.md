# 変更履歴

このプロジェクトにおけるすべての重要な変更は、このファイルに記録されます。

変更履歴のフォーマットは[変更履歴の管理](https://keepachangelog.com/ja/1.0.0/)に基づいています。

## [1.1.0] - 2026/08/12

### 追加

- Symbol/NEMのheightとノード一覧を同じNodeWatch URL組から取得するsnapshot APIを追加。
- `HeightInfo`および`Node`型を生成clientから再エクスポート。

### 修正

- `initOverrides`のRequestInit形式・関数形式でAbortSignalが中止された場合、後続URLへのfailoverを行わずキャンセルを返すように修正。
- snapshot APIでheight情報とNode一覧の必須フィールドおよび基本型を検証し、不適合な応答をURL組の失敗として扱うように修正。
- Nodeの`height`または`finalizedHeight`が`0`の未観測・未同期Nodeをsnapshotの結果から除外するように修正。
- snapshotのNode `endpoint`に絶対URIを要求し、相対URIやhostのみの値を不適合な応答として扱うように修正。

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
