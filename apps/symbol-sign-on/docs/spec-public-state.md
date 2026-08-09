# Symbol Sign-On v1 Main/Child公開状態仕様

## 文書情報

| 項目 | 内容 |
| --- | --- |
| 文書種別 | アプリケーション仕様書 |
| 対象 | Main/Child関係および強化認証に使用する公開状態 |
| 対象チェーン | Symbol |
| 対象ネットワーク | 初期検証: Testnet、正式提供: Mainnet |
| 主な上流 | [requirements.md](./requirements.md)、[sso-memo01.md](./sso-memo01.md) |
| 状態 | 初版 |

本書は、強化認証に使用するMain/Child関係、Metadata参照・変更および公開状態の判定を定義する。認証要求と署名は [spec-authentication.md](./spec-authentication.md)、失効・障害は [spec-revocation-operations.md](./spec-revocation-operations.md) を参照する。

## 1. 責任境界

公開状態は、強化認証の関係を確認するために認証基盤が参照する情報である。Symbol Metadataのプロトコル上の存在や形式は、Symbol技術資料およびOpenAPIに従って確認するが、Metadata自体にSymbolプロトコル上の認証権限があるとは解釈しない。

本書は次を定義しない。

- Metadataキー・値の最終的なwire format
- トランザクション作成、署名、手数料、アナウンスおよびウォレットUI
- Mainアカウント喪失時の復旧または別Mainへの移行
- 認証サービス内部のデータストア、キャッシュ製品または監視製品

## 2. Main/Child関係モデル

### 2.1 論理関係

強化認証の論理関係は次のとおりとする。

```text
Child C --parent--> Main M
Main M --authorizedChild--> Child C
```

- Child側の親情報は、候補となるMainを特定するために使用できる。
- Main側の認可情報は、Childを強化認証へ使用できるかの最終条件とする。
- Child側にMainへの参照が存在するだけでは認証を成立させてはならない。
- Main側の認可情報とChild側の制御確認の両方を確認できる場合だけ、Childを有効な認証鍵として扱う。
- Main/Child関係はSymbol Sign-On固有の認証規則であり、Symbolプロトコル上のアカウント階層や権限差を意味しない。

### 2.2 論理データ

| 情報 | 必須性 | 意味 |
| --- | --- | --- |
| Main識別子 | 必須 | 認証主体の通常認証鍵およびChild承認を担うアカウント。 |
| Child識別子 | 必須 | 強化認証に使用する別鍵アカウント。 |
| Main側承認 | 必須 | Mainが当該Childを強化認証へ許可していること。 |
| Child側親参照 | 必須 | Childが対象Mainを参照していること。 |
| 対象ネットワーク | 必須 | Testnet/Mainnetを分離するための情報。 |
| 状態確認時点 | 必須 | どの時点の公開状態を確認したかを示す情報。 |

具体的なMetadataキー、値の内部形式、複数Childの表現および格納位置は未決定である。双方向Metadataの構成は補足メモ上の設計候補であり、最終形式として確定していない。

## 3. 公開状態の状態機械

### 3.1 状態

| 状態 | 意味 | 新規強化認証 | 既存依存状態 |
| --- | --- | --- | --- |
| `NOT_ACCEPTED` | 変更がノードに受け入れられていない。 | 変更後状態を使用しない | 直前の確認済み状態が有効なら維持可能 |
| `PENDING_CONFIRMATION` | ノードには受け入れられたが、チェーン上の反映を確認できない。 | 変更後状態を使用しない | 直前の確認済み状態が有効なら維持可能 |
| `CONFIRMED` | チェーン上への反映を確認し、最新性・完全性・出所の信頼喪失を確認していない。 | 使用可能 | その状態に基づく認証を有効として扱える |
| `UNTRUSTED` | 最新性、完全性または出所を確認できず、認証根拠として使用できない。 | 成立させない | 期限を待たず失効 |
| `UNAVAILABLE` | 必要な公開状態を取得または確認できない。 | 成立させない | 期限を待たず失効 |

`NOT_ACCEPTED` または `PENDING_CONFIRMATION` から `CONFIRMED` になるまで、変更後の関係を有効な認証根拠として扱ってはならない。変更が存在することだけを理由に、直前の確認済み状態を `UNTRUSTED` として扱ってはならない。

### 3.2 状態遷移

```text
変更要求
  ├─ ノード未受入れ ───────────────> NOT_ACCEPTED
  ├─ ノード受入れ・反映未確認 ───────> PENDING_CONFIRMATION
  ├─ チェーン反映・信頼確認済み ─────> CONFIRMED
  └─ 最新性/完全性/出所を確認不能 ───> UNTRUSTED

参照・確認不能 ───────────────────> UNAVAILABLE
```

- `NOT_ACCEPTED` の場合、利用者へ再送可能であることを案内できる。
- `PENDING_CONFIRMATION` の場合、利用者へ待機を案内できる。
- `CONFIRMED` への遷移を確認するまで、新しい関係を強化認証に使用してはならない。
- `UNTRUSTED` または `UNAVAILABLE` になった公開状態へ依存する既存認証状態は、[spec-revocation-operations.md](./spec-revocation-operations.md) に従って失効する。

## 4. Child変更・失効

### 4.1 Child追加

1. 新Childの制御確認を行う。
2. Main側が新Childを承認する変更を受け付ける。
3. 変更が `CONFIRMED` になるまで、新Childを強化認証へ使用しない。
4. `CONFIRMED` を確認した後、新Childを有効なChildとして扱う。

### 4.2 Child変更

1. 新Childの制御確認とMain側承認を確認する。
2. 新Childの関係が `CONFIRMED` になるまで、旧Childを無効にする変更だけを理由として新Childを有効扱いしない。
3. 新Childの関係を `CONFIRMED` と確認した後、旧Childによる強化認証を成立させない。
4. 旧Childに依存する認証状態を失効させる。
5. 認証主体識別子は維持する。

### 4.3 Child失効

1. Main側の失効を `CONFIRMED` と確認する。
2. 旧Childによる強化認証を成立させない。
3. 有効な新Childが確認されるまで、強化認証を成立させない。
4. 旧Childに依存する認証状態を失効させる。
5. Mainによる通常認証は継続可能とする。

Mainアカウント自体の変更・交換・喪失から認証主体を継続することはv1の保証対象外である。

## 5. 参照とキャッシュ

- 公開状態を参照する主体は、認証基盤運用主体とする。
- 単一参照先の利用不能だけを理由に、直ちに強化認証を停止してはならない。
- 別の参照先へ切り替えても信頼できる `CONFIRMED` 状態を取得できない場合、`UNAVAILABLE` または `UNTRUSTED` として安全側に扱う。
- キャッシュを使用する場合、対象ネットワーク、Main、Child、状態確認時点および状態の信頼性を混同してはならない。
- キャッシュのTTL、外部変更の検知方法、複数参照先の一致判定および再編成時の扱いは未決定である。
- キャッシュは、未確認状態に基づく強化認証を許可するために使用してはならない。

## 6. Protocol整合性確認

Symbol OpenAPIにはMetadataの取得、Metadata Merkle情報、Account Metadata Transactionおよびネットワーク情報に関する定義がある。これらは参照経路の確認に使用できるが、次を個別に確認しなければならない。

- 対象ノード・REST Gatewayのバージョン
- Metadataのsource、target、scoped key、typeおよび値表現
- 変更がノードに受け入れられた状態とチェーン反映済み状態の判定
- 対象ネットワークとの一致
- 参照結果の最新性、完全性および出所の信頼性

APIレスポンスの存在だけで `CONFIRMED` と判定してはならない。

## 7. エラー分類

| 分類 | 条件 |
| --- | --- |
| `RELATION_NOT_FOUND` | Main/Childの必要な関係を取得できない |
| `MAIN_APPROVAL_MISSING` | Main側の承認を確認できない |
| `CHILD_CONTROL_UNCONFIRMED` | Childの制御確認が成立しない |
| `STATE_NOT_CONFIRMED` | 変更後の公開状態が未確認 |
| `STATE_UNTRUSTED` | 公開状態の信頼性を確認できない |
| `STATE_UNAVAILABLE` | 公開状態を取得・確認できない |
| `NETWORK_MISMATCH` | 公開状態と認証対象ネットワークが一致しない |
| `STALE_STATE` | 状態確認時点の最新性を確認できない |

## 8. 未決定事項・要確認事項

- Metadataキー、値形式、格納位置、複数Childの表現、更新方式
- Main側とChild側の関係を片方向または双方向で保持する最終方式
- Metadata変更に必要な署名、トランザクション構成、手数料およびアナウンス方式
- `CONFIRMED` の判定に用いる確認閾値、最終性、再編成およびロールバックの扱い
- キャッシュTTL、外部変更検知、失効反映期限
- Namespace解決結果が変化した場合の認証主体継続条件（OPEN-016）
- 対象ノード・REST GatewayのProtocol版と互換性範囲

## 9. 根拠

- requirements.md: FR-008〜FR-013、SEC-004・SEC-005、AC-006・AC-007・AC-012・AC-013・AC-014、OPEN-003、OPEN-006
- concept-sheet.md: §6、§8、§9
- sso-memo01.md: §2、§3、§5、§6
- docs/knowledge/symbol-openapi3.yml: Metadata、Namespace、network関連スキーマおよびAPI
