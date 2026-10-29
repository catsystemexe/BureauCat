# Compact Situation Journal v1 — implementation and VS agent handoff

Date: 2026-10-27. Branch: `feat/compact-situation-journal`.
Verified baseline: `79ef398b1ef72af575a2ea07a74c6539ed83ca02`, the PR #40 hover repair on top of PR #39. Both earlier branches/PRs are preserved.

Human-review simplification baseline (2026-10-29): `3906c46c45ee4266c351a64774e8c00921f6085b`. The simplification was initially prepared in the working tree only. The user subsequently authorized committing and pushing this prepared scope on `feat/compact-situation-journal` into existing draft PR #41. No PR metadata update is included.

## Behavior and boundaries

- The existing analysis creation path stores validated AI `content` on `DocumentInsight`; existing journalization already copies it to the Journal value. No new AI request or prompt change is introduced.
- `buildJournalOverview()` derives current-Situation groups from raw Journal entries and read-only evidence metadata. GET adds only scoped SELECT queries; it does not journalize, repair, backfill or alter workflow state.
- Stored values win, including an intentionally empty string. Legacy null values can display saved insight content, explanation or a saved source passage. Recognizable title/value edits suppress automatic grouping/recovery. Original analytical records and user edits remain stored and are displayed read-only. Manual notes retain the existing editor; merely opening/saving an unchanged null-value editor does not convert display fallback into stored content.
- Requests/findings, temporal meanings, questions/conflicts and explicit source risks are visible before Goal/Plan. Identification and supplementary parameters are collapsed initially. Different values in a reliably shared context are exposed as unresolved variants under questions/conflicts; neither value is selected as authoritative. Empty categories do not render.
- There is no document dropdown. When the Situation has multiple documents, each entry in the existing document list has a small native checkbox labelled **Zobrazit informace z dokumentu [název] v zápisníku**. All documents start checked; any combination filters Journal information only. Clicking the separate name still opens the document. Checkboxes neither open/unlink/delete documents nor alter AI/workflow or the unfiltered bookmark context. None shows **Informace z dokumentů jsou skryté.** while manual notes remain visible. New documents start checked; removed documents lose stale exclusions; a single remaining document stays visible without a checkbox. Changing Situation or reloading starts at all again; no selection is persisted.
- Analytical cards have no **Zdroj / N zdrojů** or original-record editing menus, and no replacement buttons/icons. Concrete statements, categories and supported variants remain. Grouping keeps the relevant evidence metadata but excludes variants supported only by disabled documents; no records or source links are merged/deleted. Detailed document analyses and document bookmark tools remain available. The existing quote/range validation and its regression coverage are retained; no source-navigation control is reintroduced on the cards.
- The document panel offers **Kontextové / Všechny** bookmarks, initially All. Context includes the unfiltered Situation Journal, expanded analysis sources and the current hovered/selected source; editing/dragging pins stay visible. Pin numbering remains based on the full document. Neither mode changes saved offsets or links.
- Explicit bookmark attachment atomically appends a source, preserves existing/unknown links, is idempotent for the same pin and rejects cross-Case attachment. Explicit item editing/archiving and Situation-scoped document deletion retain their existing write semantics.

## Matching limits

Grouping is deliberately conservative: an identifier with exactly one stable IČO/data-box ID and the same attribute, an explicit file identifier, an explicit `subject — attribute — context` title with a shared complete file citation (otherwise restricted to the same documents), or the same attribute at exactly the same saved source ranges. The Situation, category, temporal meaning and record status also scope grouping. Similar names, generic labels, missing context and recognizable user edits do not establish a match.

Comparison normalizes case/spacing, not numeric values, units, aliases or legal identity. `1,80 m` and `1,20 m` remain separate variants. No semantic entity resolver, fuzzy cross-document matching or date inference from a future Plan is claimed. Some genuine duplicates will remain separate. Unknown date meaning remains labelled unspecified; issue dates do not become risks. Records with no associated insight remain editable notes, except explicitly marked questions/conflicts, which remain visible in that category.

Legacy data cannot always distinguish an intentional historical null from discarded content. Recovery changes display only and never writes the fallback; explicit empty strings and recognizable edits are preserved. Missing saved content/passages cannot be reconstructed. The pre-existing single Journal-item association of a DocumentInsight is unchanged; projecting the same analysis into a second Situation is not generalized by this batch.

## Verification performed by Codex

The following table records the initial implementation checks. The subsequent PR #41 repair and its repeated checks are recorded separately below.

Linux: Node `24.19.0`, npm `11.9.0`, Prisma/client `6.19.3`, Next `16.2.7`, React `19.2.7`, TypeScript `6.0.3`. Existing lockfile installation was used; no dependency update or lockfile change.

| Command | Result / exit |
| --- | --- |
| `node scripts/compact-situation-journal.test.cjs` | 18 tests including parents, pass / 0 |
| `node scripts/insight-hover-bookmark-positions.test.cjs` | 11 tests including parent, pass / 0 |
| `node scripts/situation-document-removal.test.cjs` | 10 tests including parent, pass / 0 |
| `node scripts/workflow-initialization.test.cjs` | 7 tests including parent, pass / 0 |
| `npm run prisma:validate` | pass / 0 |
| `npm run prisma:generate` | pass / 0 |
| `npm run typecheck -- --incremental false` | pass / 0 |
| `npm run build` | pass / 0; existing warning below |
| `git diff --check`, plus temporary-index check including new files | pass / 0 |

Initial implementation scope inspection confirmed only its 19 implementation/regression/documentation files changed. Dependencies/lockfile, AI prompts, schema/migrations, user databases and uploads are unchanged. The initial implementation handoff was uncommitted; on 2026-10-28 the user explicitly authorized committing this prepared scope, pushing only `feat/compact-situation-journal` and opening a draft PR against `fix/insight-hover-bookmark-positions`. Next's generated `next-env.d.ts` build-path change was restored to baseline. Windows/browser acceptance and Drive synchronization remain pending.

The new regression executes the real creation/journal/evidence services and Journal GET against a disposable SQLite file using unchanged migrations and a mocked existing analysis response. It asserts retained AI content, P0 request/deadline versus issue date, all source ranges, no Goal dependency, read-only GET/query traces and identical saved snapshots after grouping/filtering, preserved edits, manual notes, safe source append, Situation isolation and document deletion. No paid AI call, user database or upload is used.

A disposable copy with only the document creation service restored from baseline `79ef398b1ef72af575a2ea07a74c6539ed83ca02` (current view/test support retained) exits `1`: the content assertion reports `actual: null`, `expected: 'Doložte souhlas vlastníka.'`. There are 16 passing tests and two failures including the parent; the corrected service passes all 18. This isolates the original content-discarding defect without claiming the whole new UI existed at baseline.

UI checks use server rendering and actual component callbacks with controlled hooks/clocks/geometry. The extended PR #40 harness covers context/all visibility, exact source scrolling/highlighting and no offset writes, alongside repeated hover/leave, scrolling, pin refresh, document switching and real drag callbacks. This is regression evidence, **not real browser layout or Windows acceptance**.

Build retains the baseline warning:

```text
Turbopack build encountered 1 warnings:
./next.config.ts
Encountered unexpected file in NFT list
```

Trace: `next.config.ts` → `src/lib/documents/markitdown.ts` → document service → Situation document DELETE route. No unrelated tracing/configuration repair is included.

## PR #41 review repair — 2026-10-28

Repair baseline: `8d3784122b055586a3919b1d5d7f72dfd0c4febe`, on the same `feat/compact-situation-journal` branch and existing draft [PR #41](https://github.com/catsystemexe/BureauCat/pull/41), base `fix/insight-hover-bookmark-positions`.

Temporal classification now checks explicit response deadlines before hearing/event context. **Lhůta dodání podkladů k jednání** and **doložte do 10 dnů od doručení** describe responding/delivering materials, not the hearing date. A dated notice heading does not move its request or deadline into collapsed document-date details. A dedicated issue-date field containing only its date remains a document date, not a risk. The number in **do 10 osob** supplies no temporal evidence, even when the saved insight is labelled `term`. An unclassified date stays visible with unspecified meaning; an unrecognized non-date stays in the visible matter category. These deterministic Czech wording rules are not a semantic/date resolver and do not synthesize new content or infer deadlines from a Plan.

`resolveSourceRange()` verifies a stored quote against the text slice at valid integer offsets. If they differ, it accepts only one exact occurrence of the original quote, including its whitespace. Repeated/overlapping matches or a missing passage return no range. Correct stored offsets can still disambiguate a repeated quote. The document panel shows the existing passage error, draws no selected-source highlight and does not scroll to stale offsets or the pin as a fallback. A later valid source clears that source-navigation error without clearing unrelated errors. Neither range resolution nor navigation writes offsets or other data.

Before the fix, the extended Journal regression exits `1`: four failing subtests plus the parent (16 pass, 5 fail, 21 total). It reports hearing materials as `event` instead of `response`, the dated notice as `document` instead of `response`, quantity capacity as `time` instead of `matter`, and stale source range `{ start: 0, end: 6 }` instead of `{ start: 6, end: 12 }`. These are expected reproductions of the repair baseline, not failures of the corrected code.

| Repeated repair check | Result / exit |
| --- | --- |
| `node scripts/compact-situation-journal.test.cjs` | 21 tests including parents, pass / 0 |
| `node scripts/insight-hover-bookmark-positions.test.cjs` | 12 tests including parent, pass / 0 |
| `npm run typecheck -- --incremental false` | pass / 0 |
| `npm run build` | pass / 0; same existing NFT warning above |
| `git diff --check` | pass / 0 |

The Journal suite still exercises the real services/GET in temporary SQLite, including edit preservation, read-only grouping/filtering, Situation isolation and deletion. The controlled component regression now also verifies recovery from wrong-but-in-bounds offsets, no scroll/highlight for missing or ambiguous quotes, source-error recovery and zero persistence requests. Existing hover/leave, scrolling, refresh, switching and actual-drag cases remain covered. No dependency, AI prompt/call, schema, migration, user database/upload or other product behavior is changed by this repair. Prisma/schema/bootstrap checks from the original batch were not repeated because those inputs are unchanged. Windows/browser acceptance and Drive synchronization remain pending.

## Human-review simplification — 2026-10-29

Baseline: `3906c46c45ee4266c351a64774e8c00921f6085b`, same branch and draft PR #41. This later approved UI direction replaces the original analytical-card source/editor menus and single-document dropdown. Earlier verification/publication records above remain historical; the current behavior is described at the top and in the handoff below.

Visibility state lives only in the Journal panel, scoped to the selected Situation. The document list reports its current IDs; removed exclusions are pruned, new IDs are enabled, and one remaining document is always visible. The derived view takes a list of selected document IDs (`null` means all, `[]` means none). It filters source support before assembling variants, without changing raw records. Manual notes retain the existing create/edit/archive/bookmark-attachment controls; analytical cards have no editor. No source record, user text or saved source range is rewritten.

| Current simplification check | Result / exit |
| --- | --- |
| `node scripts/compact-situation-journal.test.cjs` | 23 tests including parents, pass / 0 |
| `node scripts/insight-hover-bookmark-positions.test.cjs` | 12 tests including parent, pass / 0 |
| `node scripts/situation-document-removal.test.cjs` | 10 tests including parent, pass / 0 |
| `npm run typecheck -- --incremental false` | pass / 0 |
| `npm run build` | pass / 0; existing NFT warning above |
| `git diff --check` | pass / 0 |

Pure-view and frozen-data regressions cover A+B, only A, only B, none and all again, relevant evidence links, supported variants and manual notes. Actual Journal/document-list callbacks cover independent native checkbox labels, no document opening/context change or API calls during toggling, name-click opening, add/remove/re-add, single-document behavior, Situation changes and remount/reload defaults. The temporary-SQLite regression repeats multi-selection grouping with identical saved snapshots and no write queries. Existing source-range/hover/drag and transactional deletion regressions still pass. The deletion suite's deliberately injected rollback error `P2003: Foreign key constraint violated on the foreign key` is expected and its test passes. No new failures were observed.

This is controlled-hook/geometry and service evidence, not actual Windows/browser or native keyboard acceptance. Dependency/schema/Prisma inputs and AI behavior are unchanged; their original bootstrap checks were not repeated. User databases/uploads are untouched. Real Windows/browser acceptance and Drive synchronization remain pending. The subsequent user authorization covers commit/push of the prepared simplification only, without merge, deployment or Drive writes.

## VS agent — pending Windows/browser scenarios

Use a disposable database and synthetic local fixtures. Do not run normal `npm run dev` / `npm start` against protected data: their launcher forces the repository SQLite URL and runs `db:deploy`. For an isolated browser fixture, create the temporary SQLite file, apply unchanged migrations to its absolute URL with the bare Prisma CLI, and start the bare Next CLI with that same `DATABASE_URL` in the launching process. Keep fixtures/logs outside the repo and uploads; do not invoke paid analysis or touch existing user data. Record the exact tested commit plus working diff, viewport, commands, exit codes and limitations.

1. Open a Situation before Goal/Plan with documents A/B and a manual note. Analytical cards must have no source/original-record menus and no replacement buttons/icons. There must be no document dropdown. Statements, nonempty categories, collapsed identification/parameters and manual-note controls remain. Check the prior time repair: materials requested for a hearing are a response deadline, a dated notice cannot hide its request/deadline, and **do 10 osob** is not a time label.
2. Confirm both document-list checkboxes initially checked, independently focusable and labelled **Zobrazit informace z dokumentu [název] v zápisníku** using the displayed name. Exercise A+B → A → B → none → A+B using mouse and Tab/Space. None must show a short empty state plus the manual note. No checkbox operation may open, unlink/delete or select a document/Situation/Step or change AI/bookmark context. Inspect network traffic: toggles must make no API request. Click each document name separately and confirm it still opens normally without changing the checkboxes.
3. Repeat sender identification with IČO `12345678` in A/B: show one value when both support it. Prepare width values `1,80 m` and `1,20 m` under the same reliable subject/attribute/context/file citation: A+B shows both variants, A or B shows only the supported value, none shows neither. Newer timestamps never choose a winner; ambiguous names/contexts remain separate. Inspect saved/source metadata in the disposable DB/API and compare snapshots: filtering/grouping must preserve all original records, edits, links and offsets, even though cards no longer expose source menus.
4. With A/B unchecked, add/link synthetic document C using an isolated fixture and refresh the existing list. C must be checked while A/B stay unchecked. Remove C and confirm no stale information remains; reduce the list to A and confirm no checkbox and A's information visible. Re-add B and confirm it starts on. Change to another Situation and back; reload the page: all documents must start on again, while saved notes/edits remain. No paid reanalysis is needed for these fixtures.
5. Create/edit/reload/archive a manual note and attach a bookmark through its existing controls. Controls must not be expanded by this change. Previously saved user edits to analytical records must remain visible and unchanged across checkbox combinations/reload; no inline analytical editor should appear. Checkbox filtering must preserve notes even when their attached source document is off.
6. Repeat PR #39 deletion with two Situations sharing a document and unrelated notes. The actual document delete action must remove related findings/links only in that Situation after success/reload and preserve the other Situation. Check that checkbox changes have no such deletion effect. Situation button colors, aria-pressed, focus-visible and `+` remain intact; UI selection must not change the persisted active Step.
7. In detailed document/analysis tools, retain multiple expanded insights, hover/leave for more than 280 ms, scroll, refresh pins, rapidly switch documents, and toggle contextual/all bookmarks. Pins must recover positions without incidental clicking/dragging or offset writes. Only an actual drag may persist `visual_offset`. Existing controlled regressions still check quote mismatch → unique exact recovery, missing/ambiguous quotes → no unrelated highlight/scroll, and unchanged saved offsets; this is not a claim that removed Journal source menus are still a browser entry point.
8. Verify readable spacing and native checkbox focus at 1440×900 and a practical narrow viewport. Native Space/Tab behavior and real browser propagation still require VS-agent verification. The existing zero-height navigation at 544×234 remains an open BC-015 issue.

Windows/browser acceptance is pending. Earlier Windows conversion reports are not evidence for this new UI: OCR remains unavailable, short PDF fallback can suppress an OCR exception, literal Ctrl+C is unverified, Replit data import and end-to-end application upload remain untested, and the reported `MARKITDOWN_PYTHON` setting was temporary. This batch performs no merge, deployment or Drive write; mirrors 00/01/03/04 require later synchronization. BC-012 and BC-015 remain In Progress.
