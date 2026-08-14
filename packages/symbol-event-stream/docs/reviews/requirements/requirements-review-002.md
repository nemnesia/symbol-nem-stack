# Requirements Review Findings

## Review Target

- 対象: `packages/symbol-event-stream/docs/requirements/requirements.md`
- 確認日: 2026-08-14 11:15 JST
- 成果物: `packages/symbol-event-stream/docs/reviews/requirements/requirements-review-002.md`

## Execution Audit

- 実行モード: `multi_agent_v1__spawn_agent` で起動した3つの独立した Reviewer サブエージェント
- Reviewer A agent_id: `019ffe07-c19c-7371-904b-6db22b20eb4a`
- Reviewer B agent_id: `019ffe07-f2cd-7e22-811a-9c0702e64d7d`
- Reviewer C agent_id: `019ffe08-1e2d-7de3-8ab2-575f59e6b33f`
- Phase 1: 完了。`multi_agent_v1__wait_agent` で確認
- Phase 2: 完了。`multi_agent_v1__send_input` と `multi_agent_v1__wait_agent` で確認
- Chair 統合: 完了

## Evidence Used

| 種別 | 参照箇所 | 用途 |
| --- | --- | --- |
| 要件本文 | `packages/symbol-event-stream/docs/requirements/requirements.md` §2.3、§3、FR-001〜FR-007、AC-001〜AC-017、§11〜§12 | 用語、責任境界、要件、受け入れ条件、設計引継ぎの確認 |
| 要件レビュー結果 | `packages/symbol-event-stream/docs/reviews/requirements/requirements-review-001.md` RR-001〜RR-007、RR-004 | 前回指摘の状態と同一性の確認 |
| コンセプト本文 | `packages/symbol-event-stream/docs/consept/concept-sheet.md` §1〜§11 | 目的、利用者、スコープ、責任境界、成功条件との整合性確認 |
| コンセプトレビュー結果 | `packages/symbol-event-stream/docs/reviews/concept/concept-sheet-review-005.md` | 対象一致、Review Result、Required Changes、Review Gates の確認 |
| リポジトリ作業指針 | `AGENTS.md` | 根拠の区分、未確認事項、検証報告の確認 |

## Review Result

仕様設計へ進める

## Summary

前回の主要指摘のうち、継続条件、初期状態と通知なし状態、除外・再利用、Provider依存の通知範囲、候補の共通前提、重複抑制のライフサイクルは要件本文と受け入れ条件へ反映されている。コンセプトレビューの対象と判定も一致し、仕様設計を阻害するCriticalまたはMajor指摘はない。一方、操作主体の対応付けにはMinorの曖昧さが残り、ノードと成立済み接続の用語も統一されていない。Minor指摘のみのため、仕様設計へ進める判定とする。

## Finding Status

| ID | Priority | Status | 初出レビュー | 今回の確認 |
| --- | --- | --- | --- | --- |
| RR-001 | Major | Resolved | requirements-review-001 | §7、FR-005、AC-013・AC-014で、1つ以上の健全な接続が残る場合の継続と、全消失時の停止を明示している。 |
| RR-002 | Major | Resolved | requirements-review-001 | §2.3、FR-004〜FR-006、AC-001・AC-004・AC-006で、初回受入れ、通知なし状態、ブロック遅延、タイムアウト切断および最終状態を整理している。 |
| RR-003 | Major | Resolved | requirements-review-001 | FR-005、AC-005、AC-011〜AC-014で、Provider候補優先、候補枯渇時の再利用、原因別除外、継続・停止条件を明示している。 |
| RR-004 | Minor | Open | requirements-review-001 | §3で役割の大枠は定義したが、開始・候補更新・明示的終了の実行主体は「利用者側」に留まり、主体間の対応付けが完了していない。 |
| RR-005 | Major | Resolved | requirements-review-001 | §2.1、§4.2、FR-001、AC-001・AC-016で、通知領域をProviderのSymbol WebSocket Gateway契約と監視対象に依存させ、独自のイベント追加・保証を行わないことを明示している。 |
| RR-006 | Major | Resolved | requirements-review-001 | §2.3、§4.1〜§4.2、AC-017で、候補の共通前提、利用者の確認責任、Event Streamの適合性非保証・自動検証非実施を明示している。 |
| RR-007 | Major | Resolved | requirements-review-001 | FR-003、AC-003、§11、§12.1で、明示的終了までの接続切替・補充・再利用・再接続・再購読を含む重複抑制範囲を明示している。 |
| RR-008 | Minor | New | requirements-review-002 | FR-001・FR-004、AC-001・AC-004で「ノード」と「成立済み接続」が混在し、判定単位が明確でない。 |

## Required Changes

なし

## Optional Improvements

### RR-004

- Priority: Minor
- Status: Open
- 対象箇所: §3、UC-04、UC-05、FR-005〜FR-007
- 改善内容: 監視対象・候補の準備者、監視開始・候補更新・明示的終了の実行主体、継続・復旧・停止の判断主体を要件レベルで対応付ける。公開操作のAPI契約は仕様設計へ委譲できる。
- 根拠: 要件本文 §3、前回要件レビュー RR-004、コンセプトレビュー結果 CR-019
- 影響: 候補準備、ライフサイクル操作および異常時判断の責任境界に解釈差が残る。

### RR-008

- Priority: Minor
- Status: New
- 対象箇所: §2.3、FR-001、FR-004、AC-001、AC-004
- 改善内容: 初回受入れおよび遅延判定の主体を「成立済み接続」へ統一する。ノードを用いる場合は、接続先ノードと成立済み接続の関係を要件レベルで定義する。
- 根拠: 要件本文 §2.3、FR-001、FR-004、AC-001、AC-004、コンセプトレビュー結果 CR-017
- 影響: 初回受入れおよび遅延判定の対象を第三者が一意に解釈できる。

## Resolved Findings

### RR-001

- Priority: Major
- Status: Resolved
- 初出レビュー: requirements-review-001
- 対象箇所: §7、FR-005、AC-013・AC-014
- 対応確認: 1つ以上の健全な接続が残る場合は監視を継続し、健全な接続がすべてなくなった場合は監視を停止することを明記している。接続数、通知遅延、復旧時間および可用性の数値保証も除外している。

### RR-002

- Priority: Major
- Status: Resolved
- 初出レビュー: requirements-review-001
- 対象箇所: §2.3、FR-004〜FR-006、AC-001・AC-004・AC-006
- 対応確認: 初回受入れ後に通常監視を適用し、通知なしだけでは遅延・異常・停止と判定せず、タイムアウト切断は異常として扱うことを明記している。

### RR-003

- Priority: Major
- Status: Resolved
- 初出レビュー: requirements-review-001
- 対象箇所: FR-005、AC-005、AC-011〜AC-014
- 対応確認: Provider候補を優先し、候補枯渇前はブラックリスト接続を再利用せず、候補枯渇時のみ条件を満たす接続を再利用することを明記している。

### RR-005

- Priority: Major
- Status: Resolved
- 初出レビュー: requirements-review-001
- 対象箇所: §2.1、§4.2、FR-001、AC-001・AC-016
- 対応確認: v1の通知領域をProviderのSymbol WebSocket Gateway契約と利用者の監視対象に依存させ、具体的なイベント種別をEvent Streamが独自に追加・保証しないことを明記している。

### RR-006

- Priority: Major
- Status: Resolved
- 初出レビュー: requirements-review-001
- 対象箇所: §2.3、§4.1〜§4.2、AC-017
- 対応確認: 同一ネットワーク、互換性のあるGateway通信・通知契約、同一監視対象を候補の共通前提とし、確認責任を利用者、適合性非保証と自動検証非実施をEvent Streamに置いている。

### RR-007

- Priority: Major
- Status: Resolved
- 初出レビュー: requirements-review-001
- 対象箇所: FR-003、AC-003、§11、§12.1
- 対応確認: 明示的な終了まで、接続切替・候補補充・接続再利用・再接続・再購読をまたぐ同一イベントの通知レベル重複抑制を適用し、終了後・新インスタンス間は保証対象外としている。

## Deferred Findings

なし

## Review Gates

| Gate | 結果 | 根拠 |
| --- | --- | --- |
| 目的と課題 | 合格 | §1で単一Gatewayの障害、重複通知、状態差、終了後処理の課題と目的を説明している。 |
| 利用者と関係者 | 合格 | §3、UC-01〜UC-05で開発者、運用者、利用者アプリケーション、Provider、Gateway、NodeWatchの関係を定義している。RR-004はMinorの任意改善であり、ゲートを阻害しない。 |
| 対象範囲 | 合格 | §2.1〜§2.2でSymbol、Provider契約上の通知、対象外の通知方式、NEM、トランザクション、秘密情報、履歴を区別している。 |
| 要件と制約 | 合格 | §4、FR-001〜FR-007、SEC-001〜SEC-002、DR-001、§11で機能、責任、保証対象外および設計引継ぎを区別している。 |
| 受け入れ条件 | 合格 | MUST要件はAC-001〜AC-017へ追跡でき、初回受入れ、遅延、除外・補充・再利用、停止、通知範囲、共通前提を外部結果として確認できる。 |
| 内部整合性 | 合格 | 前回のMajor指摘はResolved。RR-004とRR-008はMinorで、仕様設計の開始を妨げる矛盾ではない。 |
| 不可欠な前提の現実性と安全性 | 合格 | Provider/Gateway依存、候補の確認責任、適合性非保証、秘密情報非取扱いおよび通知の信頼境界を定義している。認証方式を要件へ追加する根拠は確認できない。 |
| コンセプト整合性と前段品質判定 | 合格 | `concept-sheet-review-005.md` は対象一致、Required Changesなし、全ゲート合格、「要件定義へ進める」であり、要件書に未解決Criticalはない。 |

## Final Decision

仕様設計へ進める。前回のMajor指摘はすべて要件定義書へ反映されている。RR-004と新規RR-008はMinorの明確化事項であり、仕様設計の開始を阻害しないが、仕様化前に整理すると解釈差をさらに減らせる。
