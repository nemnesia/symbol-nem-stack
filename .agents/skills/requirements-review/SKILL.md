---
name: requirements-review
description: 要件の根拠、範囲、責任、観測可能性、検証可能性、セキュリティ、相互運用性、未決定事項をレビューし、設計へ進める品質か判定する。
---

# Requirements Review

Determine whether the requirements are a sound basis for design. Review them against the approved goals, user needs, constraints, and applicable obligations. Do not rewrite the requirements or decide architecture and implementation details.

## Before reviewing

1. Read applicable repository instructions and `../review-common/review-playbook.md`.
2. Read the assigned reviewers, security checklist, review gates, and output format.
3. Identify the requested requirements document and its approved concept or other direct upstream sources. If the target is ambiguous, do not guess.
4. Consult downstream design or implementation only to verify a concrete existing compatibility or responsibility boundary, not to generate new requirements.

## Review dimensions

- Each requirement traces to a goal, user need, constraint, approved decision, or applicable obligation.
- Purpose, actors, scope, exclusions, responsibility, assumptions, and dependencies are clear.
- Functional and quality requirements describe observable outcomes.
- Acceptance conditions are specific and independently judgeable.
- Security, privacy, interoperability, availability, data handling, and failure behavior are addressed when required by the declared scope and risks.
- Requirements distinguish decisions from assumptions, open questions, and future ideas.
- The document does not choose API fields, algorithms, libraries, database, architecture, UI details, or test frameworks unless an approved source requires them at this phase.

Use the security checklist as an inspection aid only. Do not create a finding from a checklist item without traceable source, concrete effect, and a reason the issue belongs at the requirements level.

## Findings and decision

Use the repository's review artifact location, naming, severity, finding status, and gate conventions. A finding should cite the requirement or missing traceable obligation, explain impact and why a later design choice cannot resolve it, and state a verifiable correction condition.

Do not edit the reviewed document. Report sources, checks, unverified scope, findings, gate results, and the final decision. Keep upstream feedback and deferred items separate from formal findings.
