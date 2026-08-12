---
name: release-readiness-review
description: 公開対象のnpmパッケージを公開前に再チェックし、README、CHANGELOG、package.json、SemVer、依存関係、パッケージ内容、品質検証および公開準備の不足を確認する。指定パッケージの公開可否を判定し、公開メタデータと文書だけを安全に修正して再検証する場合に使用する。実際のpublish、commit、tag、ソースコード修正は行わない。
---

# 公開前再チェック

公開対象パッケージが、現在の変更内容を正しく説明し、適切なバージョンで、安全に配布できる状態かを確認する。公開前の品質ゲートとして使用し、判定は `公開可能`、`修正後に再チェック`、`対象確認が必要` のいずれかにする。

## 対象の決定

- ユーザーがパッケージのパス、名前または対象差分を指定した場合は、その公開対象だけを確認する。
- 対象指定がない場合は、Gitの staged、unstaged、untracked の変更をパッケージディレクトリ単位で集約し、変更された `packages/*` の各ディレクトリにある `package.json` を読む。`package.json` 自身が変更されていない場合も候補に含める。
- `private: true` のパッケージ、`apps/*`、テスト用パッケージは、明示指定がない限り候補から除外する。
- 変更済みの公開パッケージが1件なら自動選択する。0件なら対象確認が必要として終了する。2件以上なら候補、パス、現在versionを示して停止する。
- 対象パッケージに公開依存する別パッケージがある場合は、依存関係と同時リリース要否を確認する。ただし、対象を勝手に追加したりversionを自動更新したりしない。

対象を決定したら、次の順序で確認する。対象が不明なまま、ファイルを変更したり検証を実行したりしない。

1. `AGENTS.md` と対象パッケージのREADME、CHANGELOG、package.json、仕様・API資料を読む。
2. Gitの差分、未追跡ファイル、未解決コンフリクト、直近タグを確認する。
3. 公開メタデータ、文書、SemVer、依存関係、公開内容を確認する。
4. ソースコードを変更せず、利用可能な品質検証を実行する。
5. 事実から修正できる公開メタデータまたは文書だけを修正する。
6. 修正後に変更範囲と検証を再確認し、成果物を `docs/reviews/<パッケージディレクトリ名>-release-readiness.md` に生成または更新する。

## 変更境界

このスキルが自動で変更してよいのは、対象パッケージの次のファイルだけである。

- `README.md`
- `CHANGELOG.md` または既存の変更履歴ファイル
- `package.json` の `version` と公開メタデータ

次は変更しない。

- `src/`、`test/`、`e2e/`、設定、fixture、生成元、lockfile
- Gitのcommit、tag、branch、remote
- npm registry、公開済みパッケージ、release設定

READMEまたはCHANGELOGがない場合、内容を推測して新規作成しない。公開阻害事項として記録する。既存資料、差分、仕様から事実を確定できない文言も追加しない。

## 公開内容の確認

### READMEと変更履歴

- READMEが存在し、対象パッケージのインストール方法、使用例、公開API、対応Node.js・モジュール環境、セキュリティ上の注意、移行・破壊的変更、ライセンスを説明しているか確認する。
- READMEのパッケージ名、version、API例、export名、依存関係およびリンクが現在の実装・package.jsonと一致するか確認する。
- CHANGELOGまたは既存の変更履歴が存在し、現在versionの見出し、変更日、変更内容を持つか確認する。
- 破壊的変更、非推奨、移行手順、互換性変更がある場合は、変更履歴に明記されているか確認する。
- 変更内容から事実を確定できる場合だけREADMEやCHANGELOGを更新する。未確認の機能説明や移行手順を発明しない。

### package.jsonと配布物

次の項目を対象の公開方式に照らして確認する。

- `name`、有効なSemVer形式の `version`、`private`、`description`
- `license`、`repository`、`homepage`、`bugs`
- `main`、`module`、`types`、`exports`、`files`、`sideEffects`
- `engines`、`publishConfig.access`、package manager情報
- dependencies、peerDependencies、optionalDependencies、devDependenciesの分類
- workspace依存が公開時に解決可能か、公開依存のversion範囲が意図に合うか
- `files` に必要なdist、README、CHANGELOG、LICENSEが含まれ、秘密鍵・.env・ログ・fixture・不要な開発ファイルが含まれないか

`npm pack --dry-run --json` または同等の非公開パッケージ化コマンドを利用できる場合は、実際の配布内容を確認する。publishは実行しない。

### 依存パッケージ

- 対象パッケージの公開依存を確認し、未公開のworkspace参照、互換性のない固定version、依存先の変更を見落とさない。
- 対象の公開APIが依存パッケージの変更を外部へ伝播する場合は、依存先のversion更新または同時リリースが必要か報告する。
- 関連パッケージを根拠なく自動version更新しない。

## SemVer判定

Git差分、公開export、型定義、README、仕様およびCHANGELOGを根拠に、現在versionから推奨versionを判定する。

- 公開API、型、データ形式、エラー契約、既定動作の後方互換性を壊す変更: `major`
- 後方互換の公開API・機能追加: `minor`
- バグ修正、内部実装、文書、テストだけの変更: `patch`
- `0.x` では、破壊変更と機能追加を次の `minor`、修正を次の `patch` とする。
- prereleaseの識別子は、正式版への移行をユーザーの意図または明示資料で確認できる場合だけ外す。`rc`、`beta`、`alpha` の追加・変更を推測しない。
- CHANGELOGの最新version、package.json、直近の対象タグが一致するか確認する。タグがない、形式が独自、または競合する場合は未確認事項として記録する。
- 推奨versionが現在versionと異なる場合、根拠が明確ならpackage.json、CHANGELOGおよび事実と矛盾しないREADME記載を更新する。根拠が曖昧なら候補を報告して変更しない。

## 品質検証

対象package.jsonの scripts と設定を先に確認し、実行するとソースや設定を変更するコマンドは避ける。`lint` や `format` が `--fix`、`--write` を含む場合は、非変更の同等コマンドまたは `--check` を使う。

可能な範囲で次を実行し、コマンド、結果、未実行理由を成果物へ記録する。

- lint
- format check
- typecheck
- unit、integration、e2e test
- build
- coverage（行・分岐・関数。90%以上を目標）
- package dry-run

coverage 90%未満だけを理由に自動で失敗判定しない。仕様上重要な未検証ケース、未カバー範囲、退行リスクがある場合は、根拠とともに `修正後に再チェック` とする。テストやbuildがない場合は成功扱いにせず、未確認として報告する。

registryのpackage存在、公開version、dist-tagはネットワーク利用可能な場合だけ読み取り確認する。registryへのpublish、削除、tag変更、認証変更は行わない。

## 公開判定

- `公開可能`: 必須文書、version、公開メタデータ、配布物、依存関係、品質検証に公開を妨げる問題がない。
- `修正後に再チェック`: version不整合、必須文書不足、公開内容の欠陥、品質検証失敗、重大な未検証範囲が残る。
- `対象確認が必要`: 対象が未指定で候補が複数、対象が公開packageでない、または根拠資料が競合して対象を一意に判断できない。

Minorな文書改善やcoverage未達だけで `修正後に再チェック` にしない。ただし、公開内容と実装の不一致、重要APIの未説明、秘密情報の同梱、SemVer誤り、検証失敗は公開阻害事項として扱う。

## 成果物

レビュー結果のテンプレートは [output-format.md](output-format.md) を使用する。成果物には次を含める。

- 対象、確認日時、確認範囲、未確認範囲
- Evidence Used と参照ファイル
- 現在version、推奨version、SemVer根拠
- README、CHANGELOG、package.json、依存関係、配布物、品質検証の結果
- 自動修正したファイルと内容
- Required Changes、未確認事項、公開阻害事項、残存リスク
- `公開可能`、`修正後に再チェック`、`対象確認が必要` の最終判定

テスト未実行、registry未確認、coverage未計測、外部環境未確認は成功として記載しない。レビュー結果そのものを対象パッケージへ同梱しない。
