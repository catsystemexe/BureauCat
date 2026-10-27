# Human-review repair: document removal and Situation selection

Baseline: `3c300fde09050c741c09a47c2fc398c878a258f6`.
Working branch: `fix/review-bookmarks-situation-ui`.

## Implemented scope

“Smazat dokument” removes the document from the currently selected Situation,
together with every related Journal finding/bookmark link in that Situation.
There are no deletion modes, authorship checks or edited-finding exceptions.
A finding with multiple sources is removed as a whole when one source matches.
Unrelated findings, other Situations and persisted workflow Steps are preserved.

The existing Situation-document DELETE endpoint now performs validation and
cleanup inside one Prisma transaction. A missing Situation/document returns
404; a cross-Case pair returns 409 without changing data. Repeating a successful
removal is safe. The UI uses this endpoint, closes the removed document context
and refreshes the Situation document list and Journal after success.

`DocumentPin` and `DocumentInsight` are document-owned in the unchanged schema;
they have no Situation owner. Removing a Situation's Journal projection clears
its insight pointer (a journalized insight becomes approved). Unused related
pins are removed and their insight pointers cleared. Pins needed by another
Situation's document link, remaining Journal references, or retained analysis
are preserved. The Case's source document, analysis documents, original files
and annotations remain available for other uses. No files in uploads are deleted.

Source IDs are compared structurally, not as JSON/text substrings. The document
ID resolver already used by the UI is shared with deletion, including legacy
`document_id` / `doc_id`, nested document references and typed document IDs.
Malformed JSON and non-array legacy values are preserved unless an explicit
insight-to-Journal pointer identifies the related finding.

Selected Situation buttons use `#000000` text on `#dbeafe`; unselected buttons
retain `#425067` on `#ffffff`. The selected selector has higher specificity,
including hover/focus-visible. The focus outline remains visible. The native
buttons, `aria-pressed`, + action, selection callbacks and workflow read API are
unchanged. This is not a repair of the previously reported 544×234 navigation
clipping; BC-015 remains In Progress.

## Codex verification

Linux, Node `24.19.0`, npm `11.9.0`; existing lockfile installation reused.
Installed versions: Prisma/client `6.19.3`, Next `16.2.7`, React `19.2.7`,
TypeScript `6.0.3`. No dependency/lockfile/schema/migration changes.

| Check | Exit | Evidence |
| --- | --- | --- |
| `node scripts/situation-document-removal.test.cjs` | 0 | Nine subtests, ten including parent: exact references/aliases, edited and mixed-source findings, malformed JSON, Situation/Case isolation, persisted readback through GET and a fresh client, shared/unshared pins, insight pointers, rollback, request guards and idempotence. |
| Same regression against exported baseline service code | 1, expected | Related findings/pins remain and missing-document guard returns 200 instead of 404. |
| `node scripts/workflow-initialization.test.cjs` | 0 | Six subtests, seven including parent; both creation paths, read-only GET, rollback and existing workflow preservation. |
| `npm run prisma:validate` | 0 | Schema valid. |
| `npm run prisma:generate` | 0 | Client 6.19.3 generated. |
| `npm run typecheck -- --incremental false` | 0 | No TypeScript diagnostics. |
| `npm run build` | 0 | Existing Turbopack/NFT warning retained, shown below. |
| Static CSS cascade inspection | 0 | Six selected/unselected × normal/hover/focus-visible combinations, including import order. Browser rendering is still pending. |
| `git diff --check` | 0 | No whitespace errors. |

The regression scripts use only temporary SQLite databases with the existing,
unchanged migrations. They do not access the application's database or uploads.
Run the scripts directly as above: in this environment `node --test` reported
only the file-level test without subtest details; that output is not used as
proof of the assertions. Full direct-run diagnostics were retained.

Expected injected rollback diagnostic (the test passes after verifying the
entire pre-operation snapshot was restored):

```text
EXPECTED ROLLBACK FAILURE P2003:
Invalid `prisma.situationDocument.deleteMany()` invocation:


Foreign key constraint violated on the foreign key
```

Existing build warning:

```text
Turbopack build encountered 1 warnings:
./next.config.ts
Encountered unexpected file in NFT list
```

The trace goes through `src/lib/documents/markitdown.ts`,
`src/lib/services/documents.ts` and the Situation-document DELETE route.
The build-generated `next-env.d.ts` path change was restored after validation.

## VS agent runtime handoff — pending

Use this branch and its prepared diff. Do not treat the earlier Windows report
on `4d9a07a0…` as verification of these new changes. Record the tested commit/diff,
OS, Node/npm versions, HTTP responses and before/after observations.

1. Use an explicitly disposable SQLite DB outside the repository and synthetic
   fixtures; preserve the user's DB and uploads. Generate Prisma Client first.
   Set an absolute `DATABASE_URL=file:…` in the application process. Apply only
   the existing migrations to this temporary DB using the bare Prisma CLI.
   Launch the bare Next CLI with this environment. Do not use `npm run dev` or
   `start` against user data: their launcher forces `data/bureaucat.sqlite` and
   automatically runs `db:deploy`.
2. Seed synthetic source text through Prisma without uploading files. Prepare
   two Situations in one Case, a source document linked to both, a separate
   document, edited/manual findings, a mixed-source finding, and shared and
   unshared bookmarks. The new regression's fixtures provide concrete data
   shapes. Also retain a different Case and its content as an isolation control.
3. In Situation A use “Smazat dokument”. Confirm the dialog describes the single
   Situation scope. After success the document and all its related findings and
   bookmark links disappear without a page reload. Unrelated findings/bookmarks
   and the other document remain. A cancel/failing response must not remove UI
   content. With no selected Situation, the delete button is disabled.
4. Reload and reselect A; check GET documents and Journal. The removed content
   must stay absent. Switch to B and reload: its document, findings/bookmarks and
   active workflow Step must remain unchanged. Check the other Case too. Repeat
   with an unshared document and confirm its unused pins are deleted. The Case
   document list still retains the reusable original; no original upload is erased.
5. At 1440×900 inspect selected and unselected numbers in normal, hover and
   focus-visible states (computed color/background included). Select with mouse,
   then Tab + Enter and Space. `aria-pressed` must follow selection, focus must
   remain visible and + must still create/select a Situation within its limit.
6. Compare workflow GET results before/after selection, deletion and reload:
   navigation must not write or change the stored ACTIVE Step. Also check a
   Situation already progressed beyond ANALYSIS. Recheck 544×234 and report the
   known clipping separately; this batch does not claim it is repaired.

No new runtime/UI verification has been performed by Codex. No commit, push,
merge, deployment or Drive write is part of this prepared diff. The new canonical
documentation changes affect Drive mirrors 00 and 03; their synchronization is
pending and no new mirror parity is claimed.
