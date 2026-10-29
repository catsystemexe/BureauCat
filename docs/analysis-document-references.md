# Analysis ↔ Document references — implementation and VS agent handoff

Date: 2026-10-29. Branch: `feat/analysis-document-references`.
Verified parent/baseline: `340fc410ee3a7a8c66ff38c12c6fb1929b0527dd` from draft PR #41. Preserve the compact Journal, independent document visibility checkboxes and distinct sibling keys. This batch is stacked against `feat/compact-situation-journal`; it does not complete BC-012/BC-015 or modify workflow state.

## Diagnosis and evidence limits

The stored chain is `DocumentInsight.id → source_pin_id → DocumentPin.id → case_bookmark_number`, with `source_document_id`, both stored ranges and both source quotes checked against the source document's displayed text (`processed_markdown ?? processed_text ?? extracted_text`). Number allocation uses Case-wide maxima in existing creation paths. This batch does not alter those writers or add a uniqueness constraint; existing data can contain missing numbers/links or duplicate numbers. There is no provenance field that reliably distinguishes how a previously linked pin was originally authored.

Baseline Document rendering could fall back to document-local ordinal numbers; Analysis showed no corresponding pin number. Sidebar pins are positioned by vertical geometry, using a pin's optional dragged visual offset. Several different source ranges on one rendered line, identical starts and overlapping ranges can therefore produce overlapping sidebar markers even with correct distinct links. The controlled regression reproduces that geometry and separately tests bad links, duplicate stored numbers and a legitimate shared pin. Those are different diagnoses.

**No snapshot of the reported Windows data was available or inspected.** Synthetic same-line overlap is not confirmation of the cause in those data. Use the read-only procedure below to identify the actual IDs, numbers, quotes and ranges before drawing that conclusion. Real font/layout, pointer/keyboard, selection and clipboard acceptance remain pending with VS agent; controlled geometry is not browser PASS.

## Resulting behavior

- A shared pure resolver validates the actual stored pin, matching source document, positive stored Case number, Case-wide number uniqueness and quote/range agreement. Both the insight and pin must resolve to the same exact passage. Existing valid offsets disambiguate repeated quotes; otherwise only one exact occurrence can recover a display range. Stored offsets are never repaired.
- Missing/invalid links, unavailable sources, duplicate numbers or incompatible passages get a diagnostic and no invented analytical number or position. There is no parallel ordinal numbering, pin merging or reanalysis. A manual bookmark without a stored number displays `?`, not an invented numeric index.
- A small colored index in Analysis and the same index at the source passage's start in Document use the attached pin's `case_bookmark_number`. Indices are inline, separate native buttons in normal flow: distinct pins at the same start remain individually reachable and can wrap rather than stacking absolutely. They use the same pin color mapping in both panels. Hover/focus marks the matching card(s), source range and source index, distinctly from simply expanded details.
- Analysis index click opens the verified source range independently of `visual_offset` and expands the detail. Document index click opens/focuses the corresponding stored Analysis insight. If multiple insights genuinely share one pin/range, the source has one index and offers each exact insight as a separate choice. Distinct pins are never coalesced merely because quotes/starts overlap.
- Valid analytical pins use inline indices instead of a competing large sidebar symbol. Unlinked/manual bookmarks keep their sidebar editor and real drag. A pin already referenced by a valid analysis uses the analytical presentation; no guess is made about its original authorship. Unverified links are not silently repaired or promoted into analytical indices.
- Indices contain no text nodes; visible digits come from CSS generated content and their accessible names contain the real number. Existing inline note numbers use the same display-only technique, keeping notes/highlights editable while avoiding annotation-number pollution of source offsets. Copy inside the source panel explicitly writes the selected original text as `text/plain`. Saved/processed text and AI input builders are unchanged. The next text node is preferred at a DOM segment boundary so ranges start at source text after an index.
- Hover/focus, navigation, resize/measurement, filtering and read GETs do not save. Only existing explicit editing/approval/bookmark actions can write. Metadata refreshes, delayed hover scrolls, document/Situation switches and navigation responses have cancellation/version guards. Journal visibility selection remains independent of AI/workflow context.

## Derived Analysis categories

Saved insight types/titles/content (or saved source text for older entries) drive bounded presentation rules, without changing types, prompts or stored analysis Markdown:

1. **Identifikace:** explicit Odesílatel and Adresát roles, contacts and file references; ambiguous/mixed roles remain under other identification data. Every original insight retains its own exact reference.
2. **Klíčové skutečnosti:** document subject/purpose, claims, obligations and other unclassified factual statements, including legal references where no other approved category applies.
3. **Podklady a přílohy:** sketches/drawings, consent and supporting materials explicitly named in saved titles or a clear saved attachment statement; an explicit response deadline or saved consequence keeps its temporal/risk meaning. A sketch date does not turn the attachment into identification or risk.
4. **Data, lhůty a události:** issue/creation, submission, delivery, response deadline and scheduled event; unspecified dates remain labelled unspecified. A deadline for hearing materials takes precedence over incidental hearing wording.
5. **Rizika a rozpory:** saved risk/conflict findings; actual consequence wording is kept distinct from temporal entries. A bare date is a date even if its old type was `risk`.
6. **Otázky:** saved explicit questions/uncertainties/missing information. Empty categories and empty identification subgroups are omitted.

This is a small lexical display classifier, not a semantic entity/date resolver. It does not infer sender/recipient from names, invent consequences or choose which contradictory value is true. Strict source-range equality may leave an old linked insight unnumbered when a pin intentionally covers a broader excerpt. Missing evidence needs human review, not automatic repair.

## Verification performed by Codex

Linux, existing lockfile installation: Node `24.19.0`, npm `11.9.0`, Prisma/client `6.19.3`, Next `16.2.7`, React `19.2.7`, TypeScript `6.0.3`. No dependency update or generated Prisma/schema change.

| Command | Result / exit |
| --- | --- |
| `node scripts/analysis-document-references.test.cjs` | 15 tests including parents, pass / 0 |
| `node scripts/compact-situation-journal.test.cjs` | 24 tests including parents, pass / 0 |
| `node scripts/insight-hover-bookmark-positions.test.cjs` | 12 tests including parent, pass / 0 |
| `node scripts/situation-document-removal.test.cjs` | 10 tests including parent, pass / 0 |
| `npm run typecheck -- --incremental false` | pass / 0 |
| `npm run build` | pass / 0; existing warning below |
| `git diff --check` including new files | pass / 0 |

Tests execute real helpers, components' callbacks and workspace navigation, plus a SELECT-only API on disposable SQLite using unchanged migrations. They cover valid indices in both panels, same-line/same-start/overlapping and repeated-text ranges, sharing versus bad links/numbers, plain-text copy and selected offsets with highlights/notes, focus/hover/click, scroll/resize, stale reference responses, document/Situation switching and explicit manual drag. Snapshot/query assertions prove the new GET does not mutate pins/insights/text or repair duplicate numbers, and that another Case's numbers do not cause a false collision. The existing Journal/hover/deletion suites remain intact in purpose; the older hover suite explicitly models manual/legacy sidebar pins, while the new suite covers matched analytical snapshots. No real Windows DB or paid AI request is used.

Initial test-fixture failures were corrected in test setup: `RangeError: Invalid time value` from a missing fixture timestamp; an obsolete simulated selection node causing `TypeError: Cannot read properties of undefined (reading 'options')` for the missing POST; and expected `note_text: null` versus the existing empty-string payload. Final checks pass. The deletion suite deliberately injects `P2003: Foreign key constraint violated on the foreign key` to prove rollback; that test passes.

Build retains `Turbopack build encountered 1 warnings: ./next.config.ts — Encountered unexpected file in NFT list`, through document conversion/DELETE tracing. It is not repaired in this batch. Browser acceptance, native clipboard/selection and dense-line wrapping remain pending; tests do not establish their visual success.

## PR #42 repair — response deadline recognition

Repair baseline: `66d470cc34e22a51bfb037993dc99884fd5af1d2`, same branch, 2026-10-29. Detailed Analysis had narrower deadline rules than the already repaired Journal. Both now reuse the Journal's bounded explicit-request/deadline rules from `src/lib/documents/deadlines.ts`; their other category rules remain separate. References, pin numbering, source validation and the simplified Journal controls are unchanged.

- `Doložte fotografie do 10 dnů od doručení.` is a response deadline, including under an attachment title, dated notice heading or issue-date label. Relative durations require request wording; they are not automatically deadlines on their own.
- Absolute deadlines support all twelve Czech month names (with or without a day-number dot), numeric dates and ISO dates. Response deadlines precede attachment and issue-date placement. A standalone issue date stays `Vyhotovení`; `do 10 osob` is not a deadline, even alongside a request for participant numbers.
- Only saved wording is recognized. No due date, calendar validity, delivery event or legal effect is calculated or inferred; no data, model/prompt, AI call, dependency or schema changes are made.

Repair checks (Linux, existing lockfile environment):

| Command | Result / exit |
| --- | --- |
| `node scripts/analysis-document-references.test.cjs` | 33 tests including parents, pass / 0 |
| `node scripts/compact-situation-journal.test.cjs` | 24 tests including parents, pass / 0 |
| `npm run typecheck -- --incremental false` | pass / 0 |
| `git diff --check` including the new helper | pass / 0 |

The expanded suite was first run against the unchanged repair baseline: exit `1`, 16 passed / 17 failed including the parent test. Diagnostics included `actual: null, expected: 'Termín reakce'` and `actual: 'Vyhotovení', expected: 'Termín reakce'`. After the repair all 33 pass. A preliminary filtered `node --test` invocation exited `1` with only `'test failed'`; the direct repository test command above supplied the reproducible assertion diagnostics. Build results in the earlier table belong to the original implementation; build was not rerun for this lexical repair.

**Additional VS scenario, still pending:** using stored synthetic insights in an isolated fixture, inspect both detailed Analysis and Journal for the quoted photographic request, a consent deadline `do 11. února 2027` under a dated/issue heading, all twelve month names, numeric/ISO dates, standalone issue date and `do 10 osob`. Check temporal labels, retained statements and unchanged source indices/targets; no computed deadline or legal consequence should appear. Do not rerun paid analysis or modify existing user records. Automated classification/controlled geometry is not Windows/browser PASS. Drive synchronization remains pending; this handoff has no mapped mirror.

## Read-only check of actual Windows links

1. Confirm the tested branch/commit and preserve the existing DB. Do not run normal `npm run dev`/`npm start` merely to inspect it: those force the repository SQLite URL and run migrations. Use an already prepared matching environment or an isolated snapshot. No paid analysis, data import, migration or pin repair is authorized.
2. With an installed SQLite CLI, open the existing DB/snapshot using `sqlite3 -readonly "C:\\path\\bureaucat.sqlite"`. Set `.parameter set @analysis_document_id THE_ANALYSIS_DOCUMENT_ID`, then `.read docs/analysis-document-reference-audit.sql` from the checkout (or use the absolute SQL-file path). This script contains SELECTs only. Record the analysis/source IDs, insight IDs, pin IDs, Case numbers, both quotes/ranges and `visual_offset`; inspect duplicate-number and shared-pin result sets separately.
3. In the matching running app, GET `/api/documents/ANALYSIS_ID/references` and `/api/documents/SOURCE_ID/references`. Compare the common reference tuples and `issues` with the SQL output. The resolver uses JavaScript UTF-16 offsets; do not use SQLite `substr()` to declare a quote mismatch, especially with emoji/surrogate pairs. A stored-offset mismatch recovered by a unique exact quote is display-only.
4. A correct join plus equal validated ranges does not prove visible separation. Capture the actual viewport, zoom, font, pin/index positions and document text in the browser. Distinct pin IDs with one duplicate stored number are a numbering defect; one pin reused for different validated ranges is a bad passage association; matching ranges/pin shared by several insights can be legitimate. Different pins sharing only a rendered row are a layout case. Do not conflate these observations.
5. Report evidence per concrete insight/pin pair and leave stored data untouched. If the snapshot cannot be shared, return the IDs/number/range diagnostics needed to distinguish these cases rather than assigning a cause from a screenshot alone.

## VS agent — pending Windows/browser scenarios

Use synthetic documents and a disposable SQLite DB for mutation/drag scenarios. Apply unchanged migrations only there using the bare Prisma CLI with an absolute temporary `DATABASE_URL`; start the bare Next CLI with that same environment. Keep fixtures/logs outside repo and user uploads. The normal npm launchers target the user's repository DB and are not the isolation mechanism.

1. Prepare at least three passages on one line, two with the same start and overlapping ranges, with distinct pins numbered 7, 12 and 22. Add two insights sharing pin 12 and exactly the same range. Both panels must show those actual numbers; every separate index must be visible/focusable at normal and narrow widths/zoom, without overlapping hidden controls. Shared pin 12 opens an insight chooser with both exact targets.
2. Hover and Tab-focus each index in both panels, including while several details are already expanded. Only the matching index/card/passage should gain the extra focus emphasis. Click/Enter each index: Analysis opens the correct source/range; Document opens the correct stored insight, expands it and scrolls its panel. Expansion/collapse by the existing title still works. No navigation request may write data.
3. Move an attached pin's existing `visual_offset` far from its source in an isolated fixture. Navigation must still use the validated evidence passage. A wrong/missing pin, source-document mismatch, duplicate Case number, repeated quote with stale offsets or incompatible shared range must yield a diagnostic/no invented analytical index. A unique exact quote may resolve the display without a database update. Preserve separate pins even at equal offsets.
4. Select partial and full source text across several indices, highlights and a note marker. Copy with keyboard and context menu into a plain-text editor; compare exact characters/whitespace with the processed source. No reference/note digits may enter the text. Create a highlight/note/manual bookmark on a selected passage in the disposable fixture and verify the saved selected text/ranges. Clipboard and browser selection behavior are not proven by the controlled test harness.
5. Scroll/smooth-scroll, resize, change zoom and rapidly switch A/B documents/analyses while requests or 280 ms hover timers are pending. Return and refresh metadata/pins. No stale index may attach to another document, and manual pins must remeasure automatically without a compensating click/drag. Indices may reflow but must retain numbers.
6. Check unlinked manual bookmarks: colors, note editor, creation/deletion and a real pointer drag still work. Only the deliberate drag should persist `visual_offset`; reload confirms it. A valid analytical pin has one compact control, not a simultaneous competing sidebar bookmark.
7. Seed stored insights for sender, recipient, contact and file number; a dated sketch/consent; issue date, submission date, delivery date, response deadline and hearing; an actual consequence/conflict; and a question. Check the six categories/subgroups, omission of empty groups and exact source indices per original finding. A sketch date stays with the supporting material; submission date is not a deadline/risk; mixed/unclear roles are not guessed. Existing analyses must work without rerunning AI.
8. Repeat the simplified Journal scenarios: no analytical-card source/edit menus or dropdown, independent A/B checkboxes, all/none/manual-note behavior, Situation reset and no duplicate sibling-key warning. Repeat Situation-scoped document deletion/shared-source isolation. Compare saved snapshots after all read-only interactions; pending Windows/browser acceptance and Drive sync must not be reported as completed.

No schema/model/prompt/dependency change, historical pin cleanup, mass reanalysis, merge, deployment or Drive write belongs to this batch. Affected canonical mirrors 00/01/03/04 need later synchronization. Existing OCR/conversion/upload and small-viewport limitations recorded in the Journal/bootstrap handoffs are not closed by these tests.
