# 07 — Security Audit

> Read-only defensive audit, generated 2026-06-10. Context: BureauCat is built
> as a **single-user, locally-hosted app** (SQLite file DB, local `data/uploads/`,
> no auth by design). Findings are rated for that context, with explicit notes on
> what changes if the app is ever exposed (e.g. public Replit deployment).

## Trust boundaries

1. **Browser → API routes** — no authentication, no sessions, no CSRF tokens.
2. **API → filesystem** — uploads written to `data/uploads/`; originals served
   back from DB-stored relative paths.
3. **API → Python subprocess** — `markitdown` conversion via `spawn`.
4. **Stored document → viewer** — converted text rendered in React.
5. **SQLite DB** — local file; stores relative file paths and document text.

**Core assumption (must stay true):** exactly one trusted user, reachable only
from a trusted network position. Every MEDIUM below becomes HIGH/CRITICAL the
moment the app is reachable by anyone else.

## What is done well ✅

- **No command injection:** `src/lib/documents/markitdown.ts` uses
  `spawn(python, [scriptPath, absolutePath])` — argument array, no shell, so
  user-controlled filenames can't inject commands.
- **No SQL injection:** Prisma only; zero `$queryRaw`/string-built queries.
- **No XSS in the viewer:** no `dangerouslySetInnerHTML` anywhere; converted
  markdown/text is rendered as React text children inside `<pre>` (escaped),
  highlights as `<mark>` with escaped content. Chat/journal/notes likewise.
- **Mass assignment blocked** where Zod is used: all schemas are `.strict()`.
- **Upload filenames sanitized & randomized:** `storage.ts` strips directory
  components (`path.parse`) and prefixes a UUID; stored under `data/uploads/`.
- **Dangerous formats excluded:** upload whitelist (pdf, docx, txt, md, rtf,
  jpg, png) excludes HTML/SVG, so the "serve uploaded file inline → stored XSS"
  path is closed by policy.
- **Content-Disposition** filename is `encodeURIComponent`-escaped — no header
  injection.
- **IDs are cuid()** — non-sequential, not enumerable.
- `.env` and `data/*.sqlite` are gitignored; no secrets found in the repo.

## Findings

### 🟠 MEDIUM (highest items in this deployment model)

#### S1. No authentication/authorization on any route — *by design, but unguarded*
Every route under `src/app/api/` mutates or reads data with no identity check.
Acceptable for localhost single-user; **critical** if deployed publicly — and
the repo contains `replit.nix`, and Next.js binds `0.0.0.0` on such hosts, so
accidental exposure is a realistic failure mode, not a hypothetical.

**Recommendation:** document the assumption in the README; add a startup
warning (or refuse-to-start) when `NODE_ENV=production` and no auth layer is
configured; if sharing is ever needed, gate with platform auth (e.g. Replit
auth) or a session layer before anything else on this list.

#### S2. File-serving route trusts DB-stored paths
`src/app/api/documents/[documentId]/original/route.ts:31` does
`path.join(process.cwd(), document.original_file)` and streams the result.
Today `original_file` is always written by `storage.ts` as a safe
`data/uploads/<uuid>-<sanitized>` value, so there is no direct injection path —
but the serving side has no defense of its own; any future writer of that
column (import feature, manual DB edit, another bug) turns this into arbitrary
file read.

**Recommendation:** add a containment check:
resolve the absolute path and verify it starts with the resolved
`data/uploads/` directory; return 403 otherwise. Cheap defense-in-depth.

#### S3. Nested resources skip ownership/relation checks
Flat ID routes operate purely by ID with no verification up the chain:
`api/goals/[goalId]`, `api/document-annotations/[annotationId]`,
`api/document-pins/[pinId]`, `api/journal/[journalItemId]`,
`api/situations/[situationId]` (e.g. `goals.ts` `updateGoal` updates
`where: { id }` without confirming the goal's situation/case). Harmless with one
user; it's the pattern that becomes IDOR the day a user model is added — and
retrofitting checks then means touching every service.

**Recommendation:** when auth is introduced, add a scoping helper
(`assertBelongsToCase(...)`) at the service layer; until then, record this as a
known constraint in the architecture docs.

#### S4. Validation gaps on three PATCH routes
`api/documents/[documentId]` (manual `typeof` checks + `as` cast,
route.ts:26-62), `api/document-annotations/[annotationId]`, and
`api/document-pins/[pinId]` parse bodies without Zod, unlike every other route.
Concretely: `visual_offset` accepts any number (no bounds), and the hand-rolled
checks can drift from the schema. Low exploitability single-user, but it's the
weakest input-validation point and also an architecture inconsistency (report 02 A2).

**Recommendation:** add the three missing Zod schemas with bounds
(`int().min(0).max(...)`, color enums from a shared constant).

#### S5. No limits on resource consumption
Upload size is capped (10 MB/file) but request count isn't; each upload spawns
a synchronous Python conversion (CPU) and writes to disk with no quota; chat
endpoints have no rate limit. Single-user: only self-DoS. Shared: disk/CPU
exhaustion. **Recommendation:** defer until/unless exposure changes; bundle
with S1 work.

### 🟡 LOW

| # | Finding | Location | Note |
|---|---|---|---|
| S6 | File type checked by extension only, not magic bytes | `src/lib/validation/documents.ts` | Whitelist is safe and files are never executed/interpreted; magic-byte check (`file-type` pkg) is optional defense-in-depth before feeding files to markitdown |
| S7 | Internal error details returned to client | e.g. `api/cases/[caseId]/documents/route.ts` returns `error.message`; markitdown failures can surface Python `stderr` (paths, versions) via `processing_error` | Fine locally; mask before any shared deployment |
| S8 | Python subprocess inherits full `env` | `markitdown.ts` (`env: process.env`) | Passes DATABASE_URL etc. to the converter; pass a minimal env instead |
| S9 | No CSRF protection | all mutating routes | Same-origin browser + no auth cookie = nothing to ride today; becomes relevant only with cookie-based auth (S1) |
| S10 | Temp-file/cleanup behavior of the converter unreviewed for crash paths | `scripts/convert_with_markitdown.py` | Worst case is orphaned temp files; housekeeping, not security |

## Malicious-document exposure

The realistic attack surface for this app is a **hostile uploaded document**
(PDF/DOCX from an adversarial counterparty — plausible for a case-management
tool). Handling chain: Node never parses the file (only stores it); parsing
happens inside Python `markitdown` and its libraries (pdfminer etc.), so a
parser exploit would execute with the app's full user privileges and env (S8).
Output is treated as plain text by React (no XSS). **Recommendations:** keep
`markitdown` dependencies updated; run the converter with a minimal env; if
paranoia is warranted later, sandbox the subprocess (timeout exists? verify;
add CPU/memory limits or a container).

## Priority list

1. **S2** path-containment check in the original-file route — 5 lines, closes the only file-read pivot.
2. **S4** Zod schemas for the three unvalidated PATCH routes — also an architecture win.
3. **S1** document the single-user assumption + production warning — prevents the catastrophic misdeployment scenario.
4. **S8/S7** minimal subprocess env + masked error messages — small hygiene fixes.
5. **S3, S5, S9** — record as preconditions for any future multi-user/auth work; don't build speculatively.

**Overall:** for its stated deployment model the app is in good shape — the
fundamentals (no shell exec, no raw SQL, no innerHTML, sanitized uploads,
strict Zod) are right. The risk concentration is entirely in "what if this gets
exposed," which is a documentation-and-guardrail problem today.
