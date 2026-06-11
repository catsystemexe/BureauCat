# 07 — Security Audit

## Scope and threat model

BureauCat stores potentially sensitive case documents and chat content. Even though multi-user functionality is out of MVP scope, the application still needs an explicit deployment trust boundary. “Single user” does not automatically mean “unauthenticated network service.”

This review covers upload, document processing, original-file delivery, API routes, input validation, authorization assumptions, filesystem/DB trust, and AI-output handling.

## Risk summary

| Severity | Count | Main themes |
|---|---:|---|
| Critical | 2 | No access control; unbounded native/subprocess document processing |
| High | 8 | File-type trust, path trust, weak bounds, mutable evidence, error handling, CSRF/deployment assumptions |
| Medium | 8 | Information leakage, lifecycle, headers, race/integrity concerns |
| Low | 3 | Operational hardening/documentation |

## Critical findings

### SEC-01 — All sensitive APIs and files are unauthenticated

- **Location:** all `src/app/api/**/route.ts` handlers; no middleware/auth layer found.
- **Impact:** Anyone who can reach the deployment can enumerate cases, read chat, download original evidence, edit/delete documents, mutate notes/pins/goals/situations, and approve AI suggestions if IDs are discoverable.
- **Authorization assumption:** Resource IDs are treated as sufficient authority.
- **Recommendation:** For MVP choose and document one explicit model:
  1. local-loopback-only desktop/single-user deployment enforced by network binding; or
  2. authenticated application/proxy session with authorization on every case-owned resource.
  Do not expose the current app publicly without a perimeter control.

### SEC-02 — Uploaded files are processed by complex parsers without resource/time isolation

- **Location:** `documents.ts:26-55`, `markitdown.ts:16-71`, `convert_with_markitdown.py`.
- **Impact:** Crafted PDF/DOCX/image/RTF content can trigger excessive CPU, memory, decompression, page rasterization, hangs, or vulnerabilities in native/transitive parsers. The 10 MB compressed upload limit does not bound decompressed work or PDF page count.
- **Recommendation:** Add subprocess timeout, output cap, PDF page/pixel limits, memory/CPU isolation where deployable, pinned dependencies, and failure-safe processing status. Prefer asynchronous processing. Treat parser packages as a high-risk trust boundary.

## High findings

### SEC-03 — File type is trusted from extension only

- **Location:** `src/lib/validation/documents.ts:42-59`.
- **Impact:** A file with an allowed suffix can contain arbitrary bytes and be sent to the corresponding parser or served under an assumed MIME type.
- **Recommendation:** Validate magic bytes/container structure and MIME consistency before processing; reject mismatches. Keep extension validation as a secondary check.

### SEC-04 — Original-file route trusts a database path

- **Location:** `src/app/api/documents/[documentId]/original/route.ts:31-32`.
- **Impact:** `path.join(process.cwd(), document.original_file)` has no containment check. Current writes generate safe paths, but any DB corruption/import/admin path mutation could permit arbitrary file reads.
- **Recommendation:** Resolve the path and verify it remains inside the configured upload root before opening. Store only generated storage keys, not arbitrary paths.

### SEC-05 — Mutable processed text can be marked validated without provenance controls

- **Location:** document PATCH route and document model.
- **Impact:** Any caller can replace processed evidence text, then mark it validated. There is no authentication, audit trail, validator identity, original hash, or revision record.
- **Recommendation:** Under a protected single-user model, at least store original file hash, processed-text revision/hash, validation timestamp, and make status transitions explicit. Preserve original evidence immutably.

### SEC-06 — JSON text inputs lack length bounds

- **Location:** chat, case/situation/goal/journal schemas and ad hoc document annotation/pin/document PATCH routes.
- **Impact:** Very large chat messages, processed text, selected text, or notes can consume memory, inflate SQLite, enlarge AI context, and cause UI denial of service.
- **Recommendation:** Add explicit character/byte maxima to every text field, aligned with the 10,000-character document MVP limit and practical chat/note limits.

### SEC-07 — Annotation/pin offsets lack strict invariant validation

- **Location:** document annotations/pins routes.
- **Impact:** Negative, reversed, non-integer, or out-of-document offsets may be persisted, corrupt interaction behavior, and amplify expensive range operations.
- **Recommendation:** Use Zod integer schemas; require `0 <= start < end <= canonicalText.length`; cap selected text and note lengths; verify selected text matches the canonical slice where appropriate.

### SEC-08 — No CSRF/origin defense for state-changing routes

- **Location:** all POST/PATCH/DELETE routes.
- **Impact:** If the app is reachable in a browser and later protected only by ambient cookies/proxy auth, another site may trigger mutations unless SameSite/origin controls are enforced.
- **Recommendation:** When adding session auth, require same-origin requests and CSRF protection appropriate to the deployment. For local-only mode, bind to loopback and validate Host/Origin.

### SEC-09 — Document processor has no output-size cap

- **Location:** `markitdown.ts:26-35`; Python converter output.
- **Impact:** A parser can emit very large stdout/markdown, growing process memory and database payload well beyond the stated 10,000-character context limit.
- **Recommendation:** Stream with a byte cap, terminate on overflow, and truncate/store according to an explicit policy before DB persistence.

### SEC-10 — Dependency supply chain is not reproducible for Python

- **Location:** `scripts/convert_with_markitdown.py` imports; no requirements/lock file.
- **Impact:** Environments may install different parser/OCR versions with different vulnerabilities and behavior.
- **Recommendation:** Pin Python dependencies and document OS packages; add dependency scanning/update policy.

## Medium findings

### SEC-11 — Original files are served inline with type inferred from extension

- **Impact:** Browser rendering of attacker-controlled content increases exposure. Text/markdown can contain untrusted content, though served as plain/markdown rather than HTML.
- **Recommendation:** Use `X-Content-Type-Options: nosniff`, a restrictive Content Security Policy, and consider `attachment` for formats that do not need inline preview.

### SEC-12 — Missing response hardening headers

- **Location:** no security header configuration found in `next.config.ts`.
- **Recommendation:** Add CSP suited to embedded PDF/image/object/iframe behavior, `nosniff`, referrer policy, frame-ancestor policy, and other standard headers after testing document preview requirements.

### SEC-13 — Error details may leak internals

- **Location:** case documents GET returns `error.message`; processing errors are stored and returned in document DTOs.
- **Impact:** Filesystem paths, parser messages, package details, or environment information may reach clients.
- **Recommendation:** Log detailed server errors with request correlation; return stable public messages. Decide whether `processing_error` is safe to expose.

### SEC-14 — Catch-all errors can hide infrastructure faults as 404

- **Location:** annotation/pin item routes.
- **Impact:** Schema drift or DB failures appear as “not found,” delaying detection and producing unsafe retry behavior.
- **Recommendation:** Match known Prisma not-found codes; return/log 500 otherwise.

### SEC-15 — File lifecycle is incomplete

- **Location:** `storeOriginalDocument`; `deleteDocumentById`.
- **Impact:** Orphaned sensitive files remain after DB deletion/failure and may persist indefinitely.
- **Recommendation:** Add coordinated deletion, startup/maintenance orphan checks, retention policy, and secure backup handling.

### SEC-16 — Source-link JSON is heuristically parsed

- **Location:** `ThreePanelWorkspace.tsx:48-182`; `source_links_json` storage.
- **Impact:** Malformed/unexpected structures can misrepresent provenance. React escaping prevents direct HTML injection in current rendering, but trust semantics are weak.
- **Recommendation:** Validate against a strict source-link schema at AI response ingestion, storage, approval, and API serialization.

### SEC-17 — AI trust boundary is partially correct but incomplete

- **Strength:** AI suggestions are Zod-validated and require approval before Journal writes.
- **Concern:** Mock AI context includes document/chat content without an explicit prompt-injection/content-trust policy; production adapters are not present yet.
- **Recommendation:** Preserve the approval gate, clearly separate untrusted document instructions from system prompts, cap context, and log model/schema version without logging sensitive full content by default.

### SEC-18 — No audit trail for destructive or authoritative changes

- **Impact:** Journal edits, validation, document deletion, suggestion approval, and evidence-state changes cannot be reconstructed.
- **Recommendation:** Version history is out of MVP scope, but minimal operational audit metadata (timestamps and action logs) should be considered before handling real sensitive cases. Do not introduce a full workflow engine.

## Low findings

### SEC-19 — Allowed development origin is hard-coded

- **Location:** `next.config.ts`.
- **Recommendation:** Move environment-specific origins to configuration and avoid committing ephemeral hostnames.

### SEC-20 — No rate limiting or concurrency controls

- **Impact:** Primarily relevant if network-exposed; upload/chat endpoints could be abused.
- **Recommendation:** Enforce at the reverse proxy or route layer if not strictly local.

### SEC-21 — No documented sensitive-data handling policy

- **Recommendation:** Document local storage location, backup behavior, deletion limitations, logs, and who can access uploaded case data.

## Trust-boundary map

```text
Browser/user input
  ├── JSON API payloads ──> route validation ──> services ──> SQLite
  ├── uploaded bytes ──> extension check ──> local filesystem
  │                                  └──> Python/native parsers/OCR
  └── selected text/offsets ──> annotation/pin persistence

SQLite values
  ├── original_file path ──> filesystem read
  ├── source_links_json ──> heuristic JSON/UI provenance
  └── suggested_item_json ──> Zod approval gate ──> JournalItem
```

The most important controls belong where arrows cross: network access, upload bytes into parsers, DB path into filesystem, AI JSON into Journal, and offsets into document rendering.

## Security priorities before real case data

1. Enforce local-only or authenticated access.
2. Repair migration reproducibility so security controls operate on known schema.
3. Bound and isolate document processing.
4. Validate file content, all text lengths, and annotation offsets.
5. Add path containment and file lifecycle cleanup.
6. Add security headers and stable error handling.
7. Document data retention and external parser dependencies.
