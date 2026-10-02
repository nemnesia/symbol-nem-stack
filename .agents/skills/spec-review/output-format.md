# Specification Review Output

Use the common review structure in `../review-common/output-format.md`. Apply this skill's conventions:

- **Finding ID:** Use the existing repository convention. Each finding identifies the affected contract, traceable source, impact, required clarification or change, and a verifiable completion condition.
- **Review Result:** Use `READY` or `REVISE SPECIFICATION` when that is the target project's established vocabulary; otherwise follow its existing terms.
- **Required Changes / Optional Improvements:** Follow the project's severity and Gate policy. A checklist item alone cannot create a required change.
- **Upstream Feedback:** Normally return to the approved design source; return to requirements only when the source of the gap is there. Do not turn feedback into a new decision or contract.
- **Deferred Findings:** Record implementation, verification, or out-of-scope questions for later work. Keep upstream gaps in the feedback section.
- **Domain Checks:** Cover the applicable external data contract, validation, errors, state, security, interoperability, compatibility, and verification. Mark material exclusions or unverified areas.
- **Scope and Traceability:** Map requirements, design decisions, and applicable standards to the reviewed contract.
