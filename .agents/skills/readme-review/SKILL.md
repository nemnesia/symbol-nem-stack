---
name: readme-review
description: READMEの説明が現在の動作、公開契約、サポート範囲、安全な利用方法と一致するかレビューする。コードや仕様は変更しない。
---

# README Review

Determine whether the README serves its intended audience and whether its claims match the current implementation and approved public contracts. Review one README or compare related README files when the request asks for consistency across packages, products, or translations.

## Before reviewing

- Read applicable repository instructions and identify the requested files and review scope.
- Use the repository's existing conventions to identify canonical README files. If the target is ambiguous, do not guess.
- Compare relevant claims against manifests, public interfaces, implementation, examples, tests, license, support policy, and authoritative documentation as applicable.
- Inspect only evidence related to the README claims under review.

## Review dimensions

- Audience, purpose, prerequisites, setup, and first-use guidance are clear.
- Commands, examples, imports, outputs, and links work for the stated environment.
- Capabilities, public interfaces, compatibility, supported platforms, limitations, and release status are accurate.
- Security guidance, handling of credentials and user data, and failure behavior do not create unsafe usage.
- Related README files preserve equivalent meaning where consistency or translation parity is requested.
- Generated content and examples do not contradict the canonical source or imply unsupported features.

Do not treat stylistic preferences as findings unless they materially obstruct use or conflict with an explicit project convention. Do not request README content that would establish new product behavior. Do not modify the README during a review unless the user separately requested an edit.

## Output

Follow the repository's review location, naming, severity, and output conventions. Tie each finding to a claim or location and current evidence, explain user impact, and provide a concise correction condition. Report checks run, unavailable evidence, and unverified claims. Do not include secrets or personal data.
