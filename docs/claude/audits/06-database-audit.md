# 06 — Database Audit (Prisma + SQLite)

> Read-only audit, generated 2026-06-10. Schema: `prisma/schema.prisma` (9 models),
> 7 migrations. No migrations were created or run as part of this audit.

## Schema summary

```
Case 1—n Situation 1—n Goal
Case 1—n Document 1—n DocumentAnnotation
                  1—n DocumentPin
Situation n—m Document        (via SituationDocument join table)
Case 1—n JournalItem
Case 1—n ChatMessage
Case 1—n AISuggestion
```

All IDs are `cuid()` strings; all child relations use `onDelete: Cascade`.
Enum-like fields are plain `String` columns with allowed values documented in
`///` comments (a reasonable convention given SQLite + Prisma's lack of enum
support there, but unenforced — see below).

## 🔴 HIGH — Migration ordering bug: fresh deploy will fail

Prisma applies migrations in **lexicographic directory-name order**. The two
2026-06-10 migrations sort as:

1. `20260610_annotation_highlight_color` — `ALTER TABLE "DocumentAnnotation" ADD COLUMN "highlight_color" TEXT;`
2. `20260610_document_annotations` — `CREATE TABLE "DocumentAnnotation" (...)` *(does not include `highlight_color`)*

The ALTER runs **before** the CREATE on a fresh database, so
`prisma migrate deploy` (which `npm run dev` / `npm start` invoke via
`db:deploy`) fails on any new environment: the ALTER targets a table that does
not exist yet, and even if ordering were fixed by accident, the CREATE lacks the
`highlight_color` column that `schema.prisma` declares. Existing databases that
applied these in their original creation order are fine, which is why this is
easy to miss locally.

**Recommendation:** verify with `prisma migrate deploy` against a scratch SQLite
file; the standard fix is to rename the create-table migration so it sorts before
the alter (or squash both into one correctly-timestamped migration) — to be done
in a separate, deliberate change, not during this audit.

## 🟠 MEDIUM findings

### M1. Non-standard migration names
- `202606091_markitdown_pipeline` — malformed timestamp (9 digits; presumably
  meant `20260609...`).
- `20260610_annotation_highlight_color`, `20260610_document_annotations` — date
  only, no time component, which is what caused the HIGH ordering bug.

**Recommendation:** always generate via `prisma migrate dev --name ...` so the
full `YYYYMMDDHHMMSS` prefix is created; never hand-name migration folders.

### M2. Redundant text columns on `Document` (schema.prisma:68-73)
`extracted_text`, `processed_text`, and `processed_markdown` coexist.
`processed_text` appears to be a transitional artifact of the markitdown
pipeline migration; the code path reads `processed_markdown` with
`extracted_text` as legacy fallback. Each column can hold an entire document, so
the redundancy roughly triples row size in SQLite and bloats every
`SELECT *`/default Prisma fetch of a Document.

**Recommendation:** decide on one canonical processed representation (+ legacy
fallback), drop the unused column in a planned migration, and use Prisma
`select` to exclude large text columns from list queries (see report 04).

### M3. `validation_status` (schema.prisma:75) — write-only field
Defaults to `"pending_validation"`; no UI or service transitions it to a
"validated" state (no documented allowed values either, unlike the other
status fields). Either an unfinished feature or dead schema.

**Recommendation:** document allowed values + wire up the workflow, or remove.

### M4. `DocumentPin` vs `DocumentAnnotation` overlap (schema.prisma:88-122)
Both store `selected_text`, `start_offset`/`end_offset`, a color
(`highlight_color` vs `color`), and `note_text`. A pin is conceptually an
annotation of type `pin`; `DocumentAnnotation.annotation_type` already exists as
a discriminator. Two tables mean two services, two API route families, and two
client code paths for nearly identical behavior.

**Recommendation:** consider merging into `DocumentAnnotation` with
`annotation_type ∈ {note, highlight, pin}` (keep `visual_offset` nullable).
Migration risk is moderate (data copy + API consolidation) — Phase 3 work.

### M5. Stringly-typed JSON columns
`JournalItem.source_links_json` (default `"[]"`) and
`AISuggestion.suggested_item_json` hold JSON as `String`. SQLite/Prisma make
this unavoidable at the column level, but nothing validates the payload shape on
write, and readers `JSON.parse` ad hoc.

**Recommendation:** centralize parse/serialize behind the service layer with the
existing Zod schemas so malformed JSON can't enter the DB.

## 🟡 LOW findings

### L1. Unenforced enum values
All `status` / `section` / `item_type` / `evidence_state` columns rely on
comments + Zod at the API edge. Direct service-layer writes (e.g. the mock AI
flow) bypass Zod. SQLite supports `CHECK` constraints, which Prisma won't
generate but can be added in a manual migration if stronger guarantees are wanted.
Acceptable for an MVP; flagging for awareness.

### L2. Index coverage — generally good, minor gaps
Present and sensible: `Situation(case_id, display_order)`, `Goal(situation_id,
display_order)`, `JournalItem(case_id, section, display_order)`,
`ChatMessage(case_id, created_at)`, `AISuggestion(case_id, status)`,
`SituationDocument` unique pair, `DocumentAnnotation(document_id,
annotation_type)`, `DocumentPin(document_id, start_offset)`.

Gaps (cosmetic at SQLite/MVP scale):
- `Document` has only `(case_id)`; list views sort by `created_at`, so
  `(case_id, created_at)` would be the matching composite.
- `Case.status` / `Case.updated_at` unindexed — fine until case counts grow.

### L3. Missing `updated_at` on `Document`
Every other mutable model has `updated_at @updatedAt`; `Document` only has
`created_at` (schema.prisma:78) despite being mutated by the processing pipeline
(status/markdown updates). Reduces auditability of the pipeline.

### L4. Naming conventions
Columns are consistently `snake_case` and models PascalCase — internally
consistent, but the API/JS layer is camelCase, so field-name translation
happens implicitly in services/components. If that ever becomes annoying,
Prisma `@map`/`@@map` can present camelCase to code while keeping snake_case in
SQL. Low priority; consistency today is acceptable.

### L5. Backfill migrations embed ID-generation conventions
`20260605190000_add_situation_document` creates IDs like
`'situation_document_' || document.id`, diverging from cuid format. Harmless,
but means ID format cannot be assumed uniform.

## Scalability outlook

- **SQLite + local file storage** ties the app to a single instance
  (`data/bureaucat.sqlite`, `data/uploads/`). Fine for the MVP/Replit model;
  any multi-user or hosted future requires Postgres + object storage, at which
  point the string-enums and JSON-string columns are worth revisiting
  (`Json` type, real enums).
- Whole-document text in row + no pagination on `ChatMessage`/`JournalItem`
  queries will be the first practical scaling pain (see report 04).
- No `User`/tenant model exists; every table hangs off `Case`. Adding auth later
  means touching every query path — worth keeping in mind before the data model
  ossifies (see report 07).

## Summary table

| # | Finding | Severity | Risk to fix |
|---|---|---|---|
| H1 | Migration ordering breaks fresh deploys | HIGH | Low (rename/squash) but must be done carefully |
| M1 | Hand-named migration folders | MEDIUM | Trivial (process change) |
| M2 | 3 redundant document-text columns | MEDIUM | Medium (data migration) |
| M3 | `validation_status` unused | MEDIUM | Low |
| M4 | Pin/Annotation table duplication | MEDIUM | Medium-high (API + data migration) |
| M5 | Unvalidated JSON-string columns | MEDIUM | Low |
| L1–L5 | Enum enforcement, index gaps, `updated_at`, naming, backfill IDs | LOW | Low |
