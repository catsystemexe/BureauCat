# BureauCat — GitHub → Drive Documentation Sync

## Status

Operational contract for BC-006. GitHub `docs/project/` is canonical under D-022. Google Drive project documents are mirrors for human reading/sharing and ChatGPT Project source access.

**Drive synchronization pending.** Bootstrap `07761fb8e31263b3a4b7605742d2e2ee0252ea40` is preserved in draft [PR #37](https://github.com/catsystemexe/BureauCat/pull/37), base `work/workflow-foundation-v01`; workflow-initialization repair `4d9a07a002f3e1a1abdcc99a28f1c69c9cc947ad` is preserved in draft [PR #38](https://github.com/catsystemexe/BureauCat/pull/38), base `chore/windows-local-bootstrap`. Later explicit authorizations superseded their original push restrictions. The current documentation-only update is prepared for review on `fix/situation-workflow-initialization`; no Drive mirror was changed or verified. Historical first synchronization does not establish parity with these changes. BC-009 remains In Progress pending documentation closeout and Drive synchronization.

## Mirrors affected by the Windows report update

The recorded Windows outcomes are taken from the VS agent reports supplied for this documentation task: lockfile installation, Prisma generation, typecheck without incremental cache, both seven-Step initialization paths, Python `3.12.10` fixture conversion (TXT/MD/DOCX/text PDF), and the actual Node conversion function via `MARKITDOWN_PYTHON` (`ok=true`, expected marker, `error=null`, exit `0`). Ordinary mouse selection passed at 1440×900. Keyboard activation via focus and Enter passed at 544×234, where pointer interaction was blocked by layout clipping. Neither selection changed the persisted active Step. Mirror the evidence limits too: missing `rapidocr_onnxruntime`/unavailable OCR, suppressed short-PDF fallback errors, zero-height navigation at `544×234`, literal `Ctrl+C` unverified, no Replit data import and no end-to-end application upload test. The test environment setting was not persisted.

When synchronization is authorized, this diff affects the existing mapped mirrors `00 — BureauCat Project State`, `03 — BureauCat Backlog`, and `04 — BureauCat Decisions`; their IDs are listed below. `README.md` and this status document `09` have no mapped Drive mirrors. Older bootstrap changes to mapped documents `01`, `02`, `05`, and `06` also remain pending; this update does not claim they are synchronized. Contracts `07`/`08` are unchanged.

## Direction

Synchronization is one-way by default:

`GitHub canonical Markdown → existing Google Drive document`

There is no automatic Drive → GitHub reverse sync.

Drive-only edits to a mirrored normative document are treated as uncommitted working changes until intentionally promoted into GitHub through the normal Designer/Coding documentation workflow.

## Canonical mapping

| Canonical GitHub file | Drive document | Drive ID |
| --- | --- | --- |
| `docs/project/00-project-state.md` | `00 — BureauCat Project State` | `1L12phV-Xe-B56ekFJjN0iJgGaHlfNQDEtcozZr_Mc2U` |
| `docs/project/01-architecture.md` | `01 — BureauCat Architecture` | `1VyZUCB6fc8vXZIflMU1TBxalz7vcFVxMWet2jIUOM94` |
| `docs/project/02-roadmap.md` | `02 — BureauCat Roadmap` | `1AuhS4l-62lbQA0sDMQW3Z1OifAfhhMviljFhPiGD1Pk` |
| `docs/project/03-backlog.md` | `03 — BureauCat Backlog` | `1Rp8mlexKhGBOx9hfpSdpCX7y6ve3QZEx4s0Cvo8YjGM` |
| `docs/project/04-decisions.md` | `04 — BureauCat Decisions` | `1UydlcBW-VaKEhGKlLK-6bd_uj0H4PKNowR9UFhI9Rh8` |
| `docs/project/05-workflow.md` | `05 — BureauCat Workflow` | `1bgYKpy760lf3ZGQtL-DIXCnMgHRr6GoFln71lnNJzac` |
| `docs/project/06-gpt-project-instructions.md` | `06 — BureauCat GPT Project Instructions` | `1XUY8Xl2uipBj1CNO_xXqS0kjaAQaq-BFBT0Ox7GzAmA` |
| `docs/project/07-workflow-persistence-state-contract.md` | `07 — Workflow Persistence & State Contract v0.1` | `1C2wrErPrvIjBhdBkN4PcqszeOUy9v10r-kwYUpoHogA` |
| `docs/project/08-ux-shell-direction.md` | `08 — UX Shell Direction v0.1` | `1Y6g64E3QfRhy-Kc3T1b24Yj704Qubaw3E03H_MJSIHA` |

## Non-canonical Drive-only material

Audit/working documents such as Consolidation Audit Plan, Audit 1, Audit 2 and Consolidation Proposal remain Drive-only historical/working material unless explicitly promoted into the canonical repo later.

## Manual sync procedure

When a canonical documentation change modifies documented truth:

1. update the canonical Markdown file in GitHub on the approved branch;
2. review/preserve the GitHub diff;
3. use the mapping above to target the existing Drive document ID;
4. replace the Drive mirror body with the current canonical Markdown content while preserving the Drive file ID/title;
5. re-read the Drive document and verify that key content matches the canonical source;
6. update Backlog/Project State only if the synchronization itself changes project status.

Do not create duplicate Drive mirror files unless an existing mapped document is irrecoverably unavailable.

## Conflict policy

For mapped normative documents, GitHub wins.

If Drive contains an unsynchronized manual edit:

- do not silently merge it during sync;
- decide whether the change should be promoted into GitHub;
- if promoted, change GitHub first and then re-sync Drive;
- otherwise the next approved sync may overwrite the Drive-only edit.

## Formatting policy

Semantic content parity is required. Drive formatting may be simpler than Markdown formatting. The first implementation prioritizes reliable content synchronization over rich Docs formatting.

## Automation

The initial mechanism is manual/operator-triggered and requires no Replit Agent credits, permanent service, or GitHub/Google service credentials.

A GitHub Action or other automation may be evaluated later only after this manual contract is stable and the credential/maintenance burden is justified.
