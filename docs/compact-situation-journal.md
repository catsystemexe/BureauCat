# Compact Situation Journal v1 — implementation and VS agent handoff

Date: 2026-10-27. Branch: `feat/compact-situation-journal`.
Verified baseline: `79ef398b1ef72af575a2ea07a74c6539ed83ca02`, the PR #40 hover repair on top of PR #39. Both earlier branches/PRs are preserved.

## Behavior and boundaries

- The existing analysis creation path stores validated AI `content` on `DocumentInsight`; existing journalization already copies it to the Journal value. No new AI request or prompt change is introduced.
- `buildJournalOverview()` derives current-Situation groups from raw Journal entries and read-only evidence metadata. GET adds only scoped SELECT queries; it does not journalize, repair, backfill or alter workflow state.
- Stored values win, including an intentionally empty string. Legacy null values can display saved insight content, explanation or a saved source passage. Recognizable title/value edits suppress automatic grouping/recovery. Original records remain individually editable; merely opening/saving an unchanged null-value editor does not convert display fallback into stored content.
- Requests/findings, temporal meanings, questions/conflicts and explicit source risks are visible before Goal/Plan. Identification and supplementary parameters are collapsed initially. Different values in a reliably shared context are exposed as unresolved variants under questions/conflicts; neither value is selected as authoritative. Empty categories do not render.
- The document filter defaults to **Všechny** and filters the derived groups/source menu only. It does not select/unlink documents, alter the application Situation/Step, or change the full Situation bookmark context. Manual notes remain available under the filter.
- **Zdroj / N zdrojů** exposes document names and individual saved passages. Selecting a source opens its document and scrolls/highlights the evidence range, independently of a pin's dragged visual offset. Missing/ambiguous passage resolution is reported instead of guessing a location. Highlighting is display-only.
- The document panel offers **Kontextové / Všechny** bookmarks, initially All. Context includes the unfiltered Situation Journal, expanded analysis sources and the current hovered/selected source; editing/dragging pins stay visible. Pin numbering remains based on the full document. Neither mode changes saved offsets or links.
- Explicit bookmark attachment atomically appends a source, preserves existing/unknown links, is idempotent for the same pin and rejects cross-Case attachment. Explicit item editing/archiving and Situation-scoped document deletion retain their existing write semantics.

## Matching limits

Grouping is deliberately conservative: an identifier with exactly one stable IČO/data-box ID and the same attribute, an explicit file identifier, an explicit `subject — attribute — context` title with a shared complete file citation (otherwise restricted to the same documents), or the same attribute at exactly the same saved source ranges. The Situation, category, temporal meaning and record status also scope grouping. Similar names, generic labels, missing context and recognizable user edits do not establish a match.

Comparison normalizes case/spacing, not numeric values, units, aliases or legal identity. `1,80 m` and `1,20 m` remain separate variants. No semantic entity resolver, fuzzy cross-document matching or date inference from a future Plan is claimed. Some genuine duplicates will remain separate. Unknown date meaning remains labelled unspecified; issue dates do not become risks. Records with no associated insight remain editable notes, except explicitly marked questions/conflicts, which remain visible in that category.

Legacy data cannot always distinguish an intentional historical null from discarded content. Recovery changes display only and never writes the fallback; explicit empty strings and recognizable edits are preserved. Missing saved content/passages cannot be reconstructed. The pre-existing single Journal-item association of a DocumentInsight is unchanged; projecting the same analysis into a second Situation is not generalized by this batch.

## Verification performed by Codex

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

Scope inspection confirms only the 19 implementation/regression/documentation files in this batch changed. Dependencies/lockfile, AI prompts, schema/migrations, user databases and uploads are unchanged. The initial implementation handoff was uncommitted; on 2026-10-28 the user explicitly authorized committing this prepared scope, pushing only `feat/compact-situation-journal` and opening a draft PR against `fix/insight-hover-bookmark-positions`. Next's generated `next-env.d.ts` build-path change was restored to baseline. Windows/browser acceptance and Drive synchronization remain pending.

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

## VS agent — pending Windows/browser scenarios

Use a disposable database and synthetic local fixtures. Do not run normal `npm run dev` / `npm start` against protected data: their launcher forces the repository SQLite URL and runs `db:deploy`. For an isolated browser fixture, create the temporary SQLite file, apply unchanged migrations to its absolute URL with the bare Prisma CLI, and start the bare Next CLI with that same `DATABASE_URL` in the launching process. Keep fixtures/logs outside the repo and uploads; do not invoke paid analysis or touch existing user data. Follow README prerequisites for the environment. Record the exact tested commit/diff, viewport, commands, exit codes and observed limitations.

1. In a Situation without Goal/Plan, prepare an existing analysis/Journal fixture: request **Doložte souhlas vlastníka**, reaction deadline **11. září**, issue date **25. srpna**, delivery **29. srpna**, event **15. září**. The concrete request and response deadline must be visible; issue date stays separately labelled in supplementary details and is not a risk. No Goal/Plan/workflow write should occur.
2. Repeat an identical sender with IČO `12345678` in two documents. Expand Identification: one displayed value, both original records and both specific sources. Repeat ambiguous `Jan Novák` without reliable identity/context: keep entries separate. Use distinct file contexts to confirm no false grouping.
3. Seed `Průchod A — šířka — měření 2026`, values `1,80 m` and `1,20 m`, quotes with the same `Č.j. SP/2026/1:`. Both variants must be visible under questions/conflicts, each with its correct source. Newer timestamps must not pick a winner. Different subject/context titles stay separate.
4. Open every source from a multi-source group, including an unbookmarked passage and a pin previously dragged away visually. Confirm the correct document, exact highlighted passage and scroll target. Missing/ambiguous quotes must not jump to an arbitrary match. Check with keyboard focus/Enter as well as mouse.
5. Change **Všechny → document A → document B → Všechny**. Verify only visible summaries/sources change. The selected Situation, open document, active persisted workflow Step, SituationDocument links, Journal rows and pin offsets must remain unchanged; compare database snapshots before/after. Resetting the view must restore all sources automatically.
6. In the document, switch **Kontextové / Všechny**, with several pins unrelated to the Situation, multiple expanded insights and an active source. Confirm correct visible subset, stable pin numbers, and keyboard focus. Scroll, hover/leave repeatedly for more than 280 ms, refresh pins and rapidly switch documents. Positions must recover without clicking/dragging, with no clustering at the top. Only a deliberate actual drag may persist `visual_offset`; reload must retain that drag result. Repeat the existing `docs/insight-hover-bookmark-positions.md` scenarios.
7. Create/edit a manual note, attach two different bookmarks, save/reload and archive it. Prior links must survive attachment; attaching the same pin twice is idempotent. Edit one original AI-projected record; filter/group/reload or reuse the stored analysis without another AI request. User text must survive. Explicitly clear a value and verify it remains empty; opening/saving an unchanged legacy null editor must preserve null.
8. Use two Situations sharing a document plus unrelated notes. Delete the document from one Situation: all related findings/links there disappear after success/reload; unrelated notes and the other Situation remain. Check PR #39 Situation button colors, aria-pressed, focus-visible and `+`; switching selection must not persist a different workflow Step.
9. Verify readable spacing, collapsed sections, no empty categories, source menus and editors at desktop 1440×900 and a practical narrow viewport. The previously reported zero-height navigation at 544×234 is still an open BC-015 issue; this change does not claim to repair it.

Windows/browser acceptance is pending. Earlier Windows conversion reports are not evidence for this new UI: OCR remains unavailable, short PDF fallback can suppress an OCR exception, literal Ctrl+C is unverified, Replit data import and end-to-end application upload remain untested, and the reported `MARKITDOWN_PYTHON` setting was temporary. This batch performs no merge, deployment or Drive write; mirrors 00/01/03/04 require later synchronization. BC-012 and BC-015 remain In Progress.
