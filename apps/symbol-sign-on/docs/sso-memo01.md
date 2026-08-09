# Symbol Sign-On 認証モデル整理メモ

## 概要

Symbol Sign-Onは、Symbolの署名を利用したパスワードレス認証を提供する。利用者にブロックチェーンの知識や複雑な鍵管理を最初から求めないことを基本方針とし、通常は1つのアカウントだけで利用できるようにする。

より高いセキュリティを求める利用者には、後からログイン専用の子鍵アカウントを追加できるようにする。子鍵の利用は任意とし、通常認証と強化認証の違いはSymbol Sign-On内部で処理する。対応サービスからは、どちらの方式を使っているかを意識せずに利用できる構成を目指す。

外部向けのSSO方式には、OAuth 2.0／OpenID Connect（OIDC）のAuthorization Code Flow + PKCEを想定する。ただし、具体的なプロトコル、API、トークン形式および保存方式は、後続の仕様設計で確定する。

```text
┌─────────────────────────────────────┐
│          OAuth 2.0 / OIDC           │
│                                     │
│ /authorize                          │
│ /token                              │
│ /userinfo                           │
│ Authorization Code + PKCE           │
│ Access / ID / Refresh Token         │
└──────────────────┬──────────────────┘
                   │
               利用者認証
                   │
       ┌───────────┴───────────┐
       │                       │
   通常認証                  強化認証
       │                       │
 単一アカウント署名       子鍵アカウント署名
       │                       │
 チェーン参照なし        Main / Childの関係を検証
       │                       │
       └───────────┬───────────┘
                   │
              認証成功
                   │
          Authorization Code
```

## 1. 通常認証：1アカウントのみ

最も簡単な利用形態では、1つのアカウントをそのままログインに使用する。

```text
Account A
  └─ ログインに使用
```

この方式では、Main／Childの区別やSymbol Metadataを使用しない。通常のログインでSymbolチェーンを参照したり、XYMを用意したりする必要もない。Symbolの鍵と署名方式でChallengeへの署名を検証するが、認証処理自体はオフチェーンで完結する。

```text
利用サービス
    │ /authorize
    ▼
Symbol Sign-On ── Challenge ──> 利用者
                                  │
                                  │ Account Aで署名
                                  ▼
                           Symbol Sign-On
                                  │
                              署名を検証
                                  ▼
                              認証成功
                                  │
                         Authorization Code
```

これは機能制限版ではなく、Symbol Sign-Onの標準的な利用形態とする。

## 2. 強化認証：MainアカウントとChildアカウント

セキュリティを高めたい利用者は、既存アカウントにログイン専用のChildアカウントを追加できる。

```text
Main Account
   │
   └─ Child Account
        └─ 普段のログインに使用
```

通常認証で使用していた`Account A`をそのままMainとして、次の構成へ移行できるようにする。

```text
Main A
  └─ Child B
```

この方式でも、利用サービスとのSSOの流れは通常認証と変わらない。違いは、Symbol Sign-On内部で「利用者認証が成功した」と判断する際に、Childの署名に加えてMain／Childの関係を検証する点にある。

```text
/authorize
    ↓
Challenge
    ↓
Child Bで署名
    ↓
署名を検証
    ↓
Main／Childの関係を検証
    ↓
認証成功
    ↓
Authorization Code
    ↓
/token
    ↓
Access Token / ID Token / Refresh Token
```

既存アカウントを作り直す必要はなく、子鍵の追加は任意とする。

### UI上の表現

一般利用者に、Mainアカウント、Childアカウント、Aggregate Transaction、MetadataといったSymbol固有の概念を最初から詳しく意識させない。UIでは、例えば「ログイン用キーを追加する」と表現する。

説明文は、次の程度を基本とする。

> 普段のログイン専用のキーを追加できます。この設定は任意です。設定しなくてもSymbol Sign-Onを利用できます。

Childを追加した後に、初めて次の注意を案内する。

> 元のアカウントは管理・復旧用として安全に保管してください。

通常認証の利用者に対して、最初からMainアカウントをしまい込むよう案内することは、通常の利用方針と矛盾するため避ける。

## 3. Main／Childの関係とMetadata

強化認証では、MainとChildの関係をSymbol Metadataで双方向に表現することを想定する。

```text
Main
  └── authorized child ──> Child

Child
  └── parent ────────────> Main
```

ただし、両方の情報を同じ重みで扱うのではなく、Symbol Sign-Onの認証規則ではMain側の認可情報を最終的な判断材料とする。

> Main側がChildを認可していることを、Child認証の最終条件とする。

Child側に「自分はMain Aの子である」と記録されているだけでは、認証を成立させない。必ずMain側の認可情報も確認する。

### Childログイン時の検証

Child Cでログインする場合は、次の順序で検証する。

```text
Child C
   ↓
Child側MetadataからMain Mを特定
   ↓
Main MのMetadataを確認
   ↓
MainがChild Cを認可していることを確認
```

概念的には、次の両方を満たす場合に認証を成功させる。

```text
C.parent == M
AND
M.authorizedChildren contains C
```

例えば、ChildからMainへの情報だけが存在し、MainからChildへの認可が存在しない場合は拒否する。攻撃者がChild側Metadataに任意のMainを記録しても、それだけでは認証できない。

「Mainの方が強い」という表現は、SymbolプロトコルのMetadata自体に権限差があるという意味ではない。あくまで、Symbol Sign-Onの認証規則上、Main側の情報を権威ある認可情報として扱うという意味である。

したがって、Main側からChildの認可を削除した時点で、そのChildは無効になる。Child側に古い`parent = Main`が残っていても、Main側に認可がなければ認証しない。この構成により、Childの秘密鍵を紛失した場合でも、Main側からChildを失効させられる。

### Metadataの保持方法に関する注意

MainからChildへの関係を、次のように別アカウントを対象とするMetadataとして直接保持する構成には注意が必要である。

```text
source = Main
target = Child
```

SymbolのMetadata更新では、構成によってはtarget側の署名が必要になる場合がある。その場合、Childの鍵を紛失した後にMainだけで認可を削除できない可能性がある。

そのため、認可情報は例えばMain自身が管理できるMetadataとして保持する構成が望ましい。

```text
Main自身のMetadata
  authorizedChild = Child address
```

Child側にも、Child自身が管理できるMetadataとして親を記録する。

```text
Child自身のMetadata
  parent = Main address
```

この場合、両者の役割を次のように分離できる。

```text
Child Metadata
  → 親の発見

Main Metadata
  → 認可判断
```

具体的なMetadataキー、値の形式、更新方法、Childの数および対象ネットワークは、仕様設計で確定する。

## 4. SSOとトークン

Symbol Sign-Onの外向きの認証方式と、Symbol Sign-On内部で利用者を認証する方式は分けて考える。

- Symbol署名は、Symbol Sign-Onが利用者本人を確認するための方式である。
- Authorization Code、Access Token、ID TokenおよびRefresh Tokenは、Symbol Sign-Onと利用サービスの間で認証結果を受け渡すための仕組みである。

この分離により、利用サービスは通常のOIDC Clientとして動作し、Symbol固有の鍵やMetadataを個別に扱わずに済む。利用サービスから見える主な処理は、次のようになる。

```text
GET  /authorize
POST /token
GET  /userinfo
```

通常認証と強化認証の差異は、Symbol Sign-On内部の本人確認処理に閉じ込める。

## 5. Metadata検証とキャッシュ

強化認証で、すべてのログインのたびにSymbolノードへ問い合わせる必要はない。Childの署名、Main／ChildのMetadataを検証した結果を、Symbol Sign-On側で一定期間キャッシュする。

```text
Child署名を検証
    ↓
Main／Child Metadataを検証
    ↓
検証結果をキャッシュ
    ↓
認証成功
```

キャッシュの概念例は次のとおりである。これは保存形式を確定するものではない。

```text
relation:{child}
  main
  verifiedAt
  expiresAt
```

有効期限内はキャッシュを利用し、期限切れまたはキャッシュ未存在の場合にオンチェーン状態を再検証する。

### 外部からMetadataが変更された場合

Symbol Sign-OnのUIを経由してChildを変更する場合は、次の処理をその場で実行できる。

```text
Metadata変更
  → relation cacheを削除・更新
  → authVersionを更新
  → 既存セッションを失効
```

一方、外部ウォレットなどから直接Metadataが変更された場合は、一時的に次の不整合が発生する可能性がある。

```text
オンチェーン状態       Childは無効
Symbol Sign-Onのcache  Childは有効
```

初期実装では、Metadataの検証結果にTTLを設定し、TTL以内にオンチェーン状態へ収束させる方式を候補とする。ノード監視によるリアルタイムのMetadata変更検知を導入するかどうかは、可用性や運用負担とあわせて別途判断する。

## 6. セッションと一括失効

端末側のキャッシュだけでは、Childの失効や強制ログアウトを確実に制御できない。Symbol Sign-On側で、ログインセッション、Main／Child関係のキャッシュおよび失効状態を管理する必要がある。

```text
端末
  │ session / token
  ▼
Symbol Sign-On
  ├─ login session
  ├─ relation cache
  └─ revocation state
        │
        ▼
Symbol blockchain
```

### Childの付け替え

Main Aに紐付くChildをChild AからChild Bへ変更する場合は、次の順序を基本とする。

1. Child Bを登録する。
2. Main側でChild Bを認可する。
3. Child Aの認可を解除する。
4. 関係キャッシュを破棄または更新する。
5. Main配下の既存認証状態を失効させる。
6. 利用者に再ログインを要求する。

子鍵の付け替え時には、既存セッションを強制的に失効させる。

### Main単位の認証バージョン

大量のセッションを個別に管理する代わりに、Main単位で認証バージョンを管理する方式を候補とする。

```text
auth:{main}
  version = 7
```

ログイン時には、セッションへ現在のバージョンを保存する。

```text
session.authVersion = 7
```

Childの変更時にMainのバージョンを`8`へ更新し、セッションに保存された値と現在値が一致しない場合は、そのセッションを拒否する。

```text
session.authVersion != current authVersion
  → セッションを拒否
```

### トークンの失効

Childの付け替え時には、少なくとも次を失効対象とする。

- Refresh Token
- Symbol Sign-Onのログインセッション
- 必要に応じたAccess Token

自己完結型JWTのAccess Tokenを完全かつ即時に失効させることは別の課題である。候補として、Access Tokenを短命にして自然失効を待ち、Refresh Tokenはサーバー側で即時失効させる方式がある。

```text
短命のAccess Token
  ＋
サーバー管理のRefresh Token
  ＋
Symbol Sign-Onのログインセッション
```

Resource Serverが毎回Symbol Sign-OnへIntrospectionを行えば、Access Tokenも即時に失効させられる可能性がある。一方で、その場合はSymbol Sign-Onへの依存と通信量が増えるため、採否は別途検討する。

## 7. Symbol Sign-On側の状態管理

現時点では、RDBを必須とする根拠はない。必要な状態がセッション、キャッシュおよび失効管理に限られるなら、Redisのようなセッションストア／キャッシュストアで実現できる可能性がある。ただし、採用するデータストアは未確定である。

保存情報の概念例は次のとおりである。

```text
session:{id}
  main
  child
  authVersion
  expiresAt
```

```text
auth:{main}
  version
```

強化認証では、さらに次のような関係キャッシュを持つ。

```text
relation:{child}
  main
  verifiedAt
  expiresAt
```

したがって、少なくとも初期検討で必要となるのは、一般的なユーザーDBというより、次の3つである。

> セッション管理、オンチェーン認可情報のキャッシュ、失効管理

## 8. 全体の設計思想

Symbol Sign-Onの構成は、次の一文で表せる。

> **Symbol Sign-Onは、1アカウントによるオフチェーン署名認証を基本とし、利用者が任意でログイン用のChildアカウントを追加することで、Symbol Metadataを利用したオンチェーン認可へ段階的にセキュリティを強化できる。Child認証ではMain側の認可情報を最終的な判断材料とし、検証結果を一定期間キャッシュする。Childの変更時には認証バージョンを更新し、既存のログイン状態とトークンを失効させる。**

重要なのは、次の2層を分離することである。

1. **利用者認証:** Symbolの署名、必要に応じたMain／Child Metadataの検証
2. **サービス連携:** OAuth 2.0／OIDCによるAuthorization Code、Access Token、ID TokenおよびRefresh Tokenの受け渡し

この構造であれば、初心者向けのシンプルなUXを維持しながら、必要な利用者にだけSymbolを活用した強化認証を提供できる。また、対応サービスは通常認証と強化認証の差異を実装する必要がなく、Symbol固有の処理をSymbol Sign-On内部に閉じ込められる。

## 9. 要確認事項

このメモは認証モデルの方向性を整理したものであり、次の事項は仕様設計で確定する必要がある。

- OAuth 2.0／OIDCを採用する範囲と、具体的なエンドポイント・トークン仕様
- Challengeの形式、署名対象および有効期限
- Main／Child Metadataのキー、値の形式、更新方法および最大登録数
- 対象ネットワーク、対象バージョンおよび参照ノードの選定方法
- MetadataキャッシュのTTL、外部変更の検知方法および不整合時の認証可否
- Access Token、Refresh Token、ログインセッションの失効条件
- Childの紛失時におけるMain側の失効操作と、復旧責任の範囲
- Redis等のキャッシュストアを含む状態管理方式
