# BureauCat — GitHub → Drive Documentation Sync

## Status

Operational contract for BC-006. GitHub `docs/project/` is canonical under D-022. Google Drive project documents are mirrors for human reading/sharing and ChatGPT Project source access.

**Snapshot synchronization completed — 2026-10-27.** ChatGPT synchronized the existing Drive mirrors 00–06 from commit `681fa5b4f1d938dff8b405edda6577e4f4b5cba0`. Readback of all seven documents confirmed exact text equality; file IDs and titles were preserved. This confirmed event supersedes the earlier pending status for that snapshot. The historical first mirror synchronization remains a separate completed event.

Bootstrap `07761fb8e31263b3a4b7605742d2e2ee0252ea40` is preserved in draft [PR #37](https://github.com/catsystemexe/BureauCat/pull/37), base `work/workflow-foundation-v01`; workflow-initialization repair `4d9a07a002f3e1a1abdcc99a28f1c69c9cc947ad` is preserved in draft [PR #38](https://github.com/catsystemexe/BureauCat/pull/38), base `chore/windows-local-bootstrap`. Later explicit authorizations superseded their original push restrictions; the Windows report documentation was published as `681fa5b4f1d938dff8b405edda6577e4f4b5cba0` on `fix/situation-workflow-initialization`.

BC-009 is recorded as Done for the approved portable local bootstrap scope. Final closure confirmation awaits the status-mirror alignment described below. The application remains incomplete, BC-015 remains In Progress, and all reported limits remain open.

## Verified snapshot and remaining status-mirror alignment

- **Verified on 2026-10-27:** mirrors 00, 01, 02, 03, 04, 05 and 06 exactly matched snapshot `681fa5b4f1d938dff8b405edda6577e4f4b5cba0` after readback.
- **After this new status commit:** align only mirrors 00 — BureauCat Project State, 03 — BureauCat Backlog, and 04 — BureauCat Decisions, then read back those three and confirm BC-009 closure. Their source Markdown files change in this commit.
- **Not yet performed:** this new alignment of 00, 03 and 04. No Drive parity with this new commit is claimed, and this repository status update writes nothing to Drive.
- Mirrors 01, 02, 05 and 06 are unchanged by this status commit and need no further alignment for it. Contracts 07/08 are unchanged and are outside the verified 00–06 synchronization event.
- `README.md` and this status document 09 have no mapped Drive mirrors. Existing IDs and titles in the mapping below must remain preserved.

The recorded Windows outcomes are taken from the VS agent reports supplied for this documentation task: lockfile installation, Prisma generation, typecheck without incremental cache, both seven-Step initialization paths, Python `3.12.10` fixture conversion (TXT/MD/DOCX/text PDF), and the actual Node conversion function via `MARKITDOWN_PYTHON` (`ok=true`, expected marker, `error=null`, exit `0`). Ordinary mouse selection passed at 1440×900. Keyboard activation via focus and Enter passed at 544×234, where pointer interaction was blocked by layout clipping. Neither selection changed the persisted active Step. Mirror the evidence limits too: missing `rapidocr_onnxruntime`/unavailable OCR, suppressed short-PDF fallback errors, zero-height navigation at `544×234`, literal `Ctrl+C` unverified, no Replit data import and no end-to-end application upload test. The test environment setting was not persisted.

## Direction

Approved right-panel revision (2026-10-30), baseline `6699f1c55125223e418d2fc2ef68127d5fe9b19a`: changed mirrors **00, 01, 03, 04, 07 and 08** require later synchronization/readback. This has not been performed. `docs/situation-right-panels.md`, README and document 09 have no mapped mirror. No Drive write or current-parity claim is made.

Goal → Plan → Collection MVP (2026-10-30), `feat/situation-goal-plan`, baseline `5595ad8fab84eec6d9040b6d4111145a471f2997`: affected mirrors **00, 01, 02, 03, 04, 07 and 08** require later synchronization/readback after review/preservation. That synchronization has not been performed. `docs/situation-goal-plan.md`, README and this document have no mapped mirrors. No Drive write, new parity claim or change to existing mirror IDs/titles belongs to this batch.

Analysis ↔ Document follow-up (2026-10-29), `feat/analysis-document-references`, baseline `340fc410ee3a7a8c66ff38c12c6fb1929b0527dd`: changed mirrors **00, 01, 03 and 04** require later synchronization after review/preservation. This synchronization has not been performed. The handoff and read-only SQL under `docs/analysis-document-references.md` / `docs/analysis-document-reference-audit.sql` have no mapped Drive mirrors. No current Drive parity or Drive write is claimed.

Current follow-up — compact Situation Journal v1 (`feat/compact-situation-journal`, baseline `79ef398b1ef72af575a2ea07a74c6539ed83ca02`): the 2026-10-29 human-review simplification starts from `3906c46c45ee4266c351a64774e8c00921f6085b`. Mirrors **00, 01, 03 and 04** require synchronization after the implementation/documentation diff is reviewed and preserved. That synchronization has not been performed. The earlier snapshot-specific 00–06 verification and pending bootstrap-status alignment above remain historical evidence, not proof of current parity. Document 09 and `docs/compact-situation-journal.md` have no mapped mirrors. This batch writes nothing to Drive and does not change existing mirror IDs/titles.

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


The one-Goal/trigger/document-overview follow-up on PR #43 changes canonical 00, 01, 03, 04, 07 and 08 again. Their mirrors still await authorized synchronization/readback; no new Drive parity is claimed.


The brief source-removal repair additionally updates 00, 07 and 08; these mirrors remain pending along with the already listed unsynchronized documents. No Drive write or current parity is asserted.


The three-section Analysis simplification updates canonical 00, 01, 03, 04, 07 and 08; their mirrors remain pending. Earlier snapshot-specific synchronization is historical, not parity with this follow-up. No Drive write was performed.


The K doplnění completion-form revision again changes canonical 00, 01, 03, 04, 07 and 08. Their mirror alignment/readback remains pending; this work performs no Drive synchronization.


The 2026-10-31 minimal-information revision changes canonical 00, 01, 03, 04, 07 and 08 again; existing mirror alignment/readback remains pending. No Drive write or current parity is claimed.
