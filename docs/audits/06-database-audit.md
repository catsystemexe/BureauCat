# 06 — Database Audit

## Executive assessment

The current Prisma schema is not reproducible from the checked-in migration history. This is a **critical release blocker**. A clean `prisma migrate deploy` would encounter an out-of-order annotation migration and, even if repaired, would not create all fields/tables represented by `schema.prisma`.

The schema also reflects a situation/goal/annotation/pin expansion that conflicts with the authoritative MVP v1.2 domain model.

## Model inventory

| Model | Purpose | MVP v1.2 status |
|---|---|---|
| `Case` | Case root | In scope |
| `Document` | Evidence document | In scope, but extended with processing fields |
| `JournalItem` | Authoritative case-model item | In scope |
| `ChatMessage` | Chat/intake messages | In scope |
| `AISuggestion` | User-review gate for AI Journal changes | In scope |
| `Situation` | Situation submodel | Not in authoritative v1.2 |
| `Goal` | Situation-level goal | Duplicates JournalItem GOAL concept |
| `SituationDocument` | Situation-document join | Not in authoritative v1.2 |
| `DocumentAnnotation` | Highlights/notes/questions/issues | Beyond optional simple citation highlighting |
| `DocumentPin` | Bookmark/pin | Not in authoritative v1.2 |

## Critical migration findings

### DB-01 — Migration ordering is invalid

- `20260610_annotation_highlight_color/migration.sql` runs lexicographically before `20260610_document_annotations/migration.sql`.
- The first migration executes `ALTER TABLE "DocumentAnnotation" ADD COLUMN ...` before the table exists.
- **Severity:** CRITICAL.
- **Risk:** Clean deployment fails immediately.
- **Recommendation:** Repair through a deliberate migration-history strategy. Because migrations may already have been applied in some environments, do not merely rename directories without checking deployment state. Establish whether any shared database exists, then create a safe baseline/resolve procedure.

### DB-02 — `Document.processed_text` has no migration

- Present at `prisma/schema.prisma:69`.
- Not present in initial migration or later migrations.
- **Severity:** CRITICAL.

### DB-03 — `Document.validation_status` has no migration

- Present at `prisma/schema.prisma:75`.
- No migration creates it.
- **Severity:** CRITICAL.

### DB-04 — `DocumentPin` has no migration

- Model exists at `prisma/schema.prisma:106-122`.
- No checked-in SQL creates the table or indexes.
- **Severity:** CRITICAL.

### DB-05 — Annotation schema has drift

- `highlight_color` is split into a migration that runs before table creation.
- Client TypeScript expects `DocumentAnnotation.visual_offset`, but Prisma does not define it.
- **Severity:** HIGH.

### DB-06 — Existing local DB may conceal drift

The scripts point to `data/bureaucat.sqlite`, which is ignored. A developer database altered manually or via `prisma db push` could support current code while clean environments fail.

- **Severity:** HIGH.
- **Recommendation:** Add a CI smoke check that creates an empty temporary SQLite database and runs the committed migration chain, followed by Prisma validation and a minimal query.

## Schema design review

### Redundant / overlapping fields and entities

| Item | Concern | Recommendation |
|---|---|---|
| `Situation.description` | Violates “Description is JournalItems” rule | Remove from MVP model or migrate content into `JournalItem(section=description)` |
| `Goal` versus `JournalItem(item_type=GOAL, section=goals)` | Two sources of truth | Use JournalItem only under v1.2 |
| `Document.extracted_text`, `processed_text`, `processed_markdown` | Semantics overlap and update behavior is unclear | Define canonical raw extraction, normalized display text, and optional format; avoid storing identical text twice without reason |
| `source_links_json` | Unstructured JSON string with no relational integrity | For MVP, validate a strict JSON array schema on every read/write; a normalized relation can wait |
| `AISuggestion.suggested_item_json` | Necessary as review payload, but stringly typed | Keep for MVP but validate at creation and approval; consider JSON type only when moving beyond SQLite constraints |
| `assistant_reply` on each suggestion | Same reply may be duplicated across multiple suggestions | Store only if needed for provenance; otherwise link suggestions to the assistant message in a later schema revision |
| `DocumentAnnotation` + `DocumentPin` | Overlapping selected text, offsets, color, notes | Defer both from MVP or define one annotation model later |

### Naming

- Database fields consistently use snake_case, while Prisma model names use PascalCase. This is internally consistent but leaks directly into TypeScript/UI contracts.
- `Case` is a potentially awkward model name across languages/tools but works in Prisma/SQLite.
- `original_file` stores a path, not file contents; `original_file_path` would be clearer if schema changes are already required.
- String statuses need enforced naming/casing. Most are lowercase, while Journal item types are uppercase.
- `visual_offset` is ambiguous: viewport pixels, document pixels, or character offset are materially different concepts.

## Index review

### Existing useful indexes

- `Situation(case_id)` and `(case_id, display_order)`.
- `Goal(situation_id)` and `(situation_id, display_order)`.
- `Document(case_id)`.
- `DocumentAnnotation(document_id)` and `(document_id, annotation_type)`.
- `DocumentPin(document_id)` and `(document_id, start_offset)`.
- `SituationDocument` indexes plus unique `(situation_id, document_id)`.
- `JournalItem(case_id)` and `(case_id, section, display_order)`.
- `ChatMessage(case_id, created_at)`.
- `AISuggestion(case_id, status)`.

### Missing or improvable indexes

| Query pattern | Current support | Recommendation |
|---|---|---|
| Cases ordered by `created_at DESC` | No index | Add `Case(created_at)` only if case counts grow beyond trivial MVP volume |
| Situations filtered by case/status and ordered | `(case_id, display_order)` only | If situations remain, `(case_id, status, display_order)` matches active navigation/backfill logic |
| Goals filtered by situation/status and ordered | `(situation_id, display_order)` | If goals remain, consider `(situation_id, status, display_order)` |
| Journal active items by case/section/order | Existing index lacks status | Consider `(case_id, section, status, display_order)` if UI filters active frequently |
| Suggestions by case/status ordered by creation | `(case_id, status)` | Consider `(case_id, status, created_at)` |
| Annotations overlap query | `(document_id, annotation_type)` | If retained, `(document_id, annotation_type, start_offset, end_offset)` may help but SQLite range overlap still needs review |
| Pins ordered by document/start | Existing `(document_id, start_offset)` | Appropriate if table migration exists |

Avoid speculative indexes until canonical scope and real query plans are known; SQLite write cost matters.

## Relation and integrity review

### Strengths

- Core child relations use `onDelete: Cascade`.
- Situation-document join has a uniqueness constraint.
- Link service explicitly checks case ownership consistency.

### Weaknesses

- SQLite/Prisma string fields do not enforce allowed enum values at DB level.
- `JournalItem.source_links_json` can reference nonexistent documents.
- Annotation/pin offsets are not constrained (`start >= 0`, `end > start`) at DB level and are weakly validated at API level.
- No unique ordering constraints exist, so concurrent inserts can produce duplicate `display_order` values.
- `createGoal` and `createSituation` calculate `max + 1`; SQLite transactions reduce but do not fully communicate an ordering invariant.
- A Document belongs to a Case, while SituationDocument adds another path; only application code prevents cross-case joins.

## Future scalability

SQLite is appropriate for a single-user MVP. The following patterns will become limiting first:

1. Long synchronous write transactions during annotation splitting.
2. Full chat/document list reads.
3. Files stored on local disk without a managed lifecycle.
4. JSON strings requiring application parsing.
5. Exact-offset annotations invalidated by text revisions.
6. Lack of authentication/user ownership if deployment becomes shared.

These are not reasons to switch databases now. Scope alignment and migration correctness are higher priorities.

## Migration-risk remediation plan

1. **Freeze schema changes** until deployment history is understood.
2. Inventory every existing environment/database and its `_prisma_migrations` rows.
3. Decide whether this repository is pre-release with disposable DBs or has data that must be preserved.
4. Produce one reviewed repair plan:
   - disposable/pre-release: replace with a clean baseline migration matching the approved v1.2 schema;
   - preserved data: add forward-only repair migrations and use `prisma migrate resolve` as documented per environment.
5. Add a clean-database migration smoke test.
6. Add a schema-vs-migration drift check.
7. Only then migrate/remove out-of-scope models and fields.

No migration should be generated as part of general cleanup; this requires its own reviewed data-change task.
