# SymTax Implementation Specification Feedback

## IF-001 — Continuation token integrity is underspecified

- **対象:** `SPEC-PAGE-003`、Phase 1 continuation codec
- **仕様上の契約:** tokenが改変・破損された場合は`invalid-continuation`として拒否する。
- **確認した不足:** 仕様はtokenをquery条件へ束縛するが、token内容の完全性を検証する方式・鍵の所有者・鍵の配備範囲を定めていない。署名なしのbase64url payloadでは、同じaddress / network / category / period / pageSizeのまま、構文的に妥当な`lastKey`へ書き換えたtokenを改変として判定できない。
- **現状の実装境界:** Phase 1 codecはtoken形式、page size、snapshot、order key構造およびquery bindingを検証する。MongoDB queryへcursorを渡す処理はまだ存在しない。暗号署名や新しいsecret設定は仕様にないため追加していない。
- **必要な判断:** Specificationで、改変検出を満たすtoken integrity方式と、それに必要なkey lifecycle / deployment consistencyを定めるか、拒否要件を検証可能な範囲へ明確化する。
- **影響:** Cursorを実queryへ接続する実装は、この判断まで開始しないこと。既存のaddress・period・network等のbinding拒否には影響しない。
