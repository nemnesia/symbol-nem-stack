---
name: readme-author
description: 実際のmanifest、公開インターフェース、実装、テスト、対応機能を根拠にREADMEを作成・更新する。READMEで新しい動作を定義しない。
---

# README Author

Create or update a README that helps its intended readers understand and use the project as it exists today. Treat implementation, approved contracts, and repository conventions as evidence; do not make the README a source of new requirements or design decisions.

## Before editing

1. Read applicable repository instructions, such as `AGENTS.md`, when present.
2. Read the target README and inspect its audience, language, location, and existing structure.
3. Discover the relevant manifests, public interfaces, implementation, tests, examples, license, and authoritative product documentation from the repository. Inspect only the files that support claims made in the README.
4. Check user-provided requirements and any existing review feedback relevant to the requested change.

## Scope and evidence

- Follow an explicitly requested output path and change boundary.
- If the target or canonical README is ambiguous, identify the candidates and ask for clarification before editing.
- Update existing files only within the requested scope. Do not create parallel documentation when the repository already identifies a canonical file.
- Describe current capabilities, prerequisites, installation or setup, first use, examples, errors, limitations, platform support, and security considerations only when relevant to the project's audience.
- Verify commands and examples against the actual project. Mark previews, planned features, and unsupported behavior clearly.
- Keep README guidance at the user-facing level. Link to detailed specifications instead of duplicating them.
- Never include real credentials, private data, secret keys, or unsafe examples. Use clearly synthetic values and explain any material security boundary.
- Preserve the README's language and established terminology unless translation or editing is requested.

## Workflow

1. Confirm the target, readers, requested change, and repository conventions.
2. Trace each proposed claim and command to current project evidence.
3. Draft only the requested README content and links.
4. Check links, code fences, commands, terminology, and cross-document consistency.
5. Review the diff for unsupported claims, accidental secret material, and unrelated edits.

Do not edit implementation or specification files as part of README authoring. Report any discrepancy as a documentation question or follow-up issue instead of silently changing product behavior.
