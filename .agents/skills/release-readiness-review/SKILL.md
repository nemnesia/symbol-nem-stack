---
name: release-readiness-review
description: リリース内容、公開契約、配布物、セキュリティ境界、リリース根拠を照合する。公開、tag、ソース変更は行わない。
---

# Release Readiness Review

Determine whether the requested release set is accurately described, reproducible from the repository, and supported by sufficient evidence. Review the release workflow and artifacts without performing publication or other external mutations.

## Review scope

- Confirm the release target and artifact set from the request and repository configuration.
- Read applicable repository instructions and the existing release policy, manifests, user documentation, license, change history, build and packaging workflows, and relevant approved contracts.
- Inspect generated or packaged contents only when they are available locally or through an authorized read-only process.
- Match the review depth to the actual release: a single package, multiple related artifacts, a source release, or another distribution model.
- Do not assume a particular language, package manager, registry, signing service, CI provider, or directory layout.

## Review dimensions

Check applicable areas such as:

- Version and release metadata agree across the project.
- The announced capabilities, compatibility, support status, and limitations match the current implementation.
- Public interfaces and compatibility claims match approved contracts and shipped artifacts.
- Package contents include required files and omit secrets, local state, unrelated development files, and misleading generated output.
- Build and release steps are traceable, reproducible to the level promised, and protected by appropriate permissions.
- Required tests, provenance, signatures, checksums, or attestations are present when project policy or the release contract requires them.
- Dependencies, licenses, security notices, and known limitations are represented accurately.
- Release instructions identify the responsible actors and any required manual verification.

A checklist item is not by itself a finding. Tie each finding to an applicable project policy, approved contract, observable release risk, or user request. Do not invent additional release requirements or block a release on an optional practice without a concrete impact.

## Output and boundaries

Use the repository's existing review location, naming, severity, and gate conventions. If none exist, create a clearly named review artifact only when the user requested a written review; otherwise report findings in the response. Do not overwrite prior review evidence.

Do not publish, upload, tag, push, merge, change registries, or edit source files. Record the evidence reviewed, findings with impact and completion criteria, checks not performed, and the resulting readiness decision. Distinguish repository review from external registry or production verification.
