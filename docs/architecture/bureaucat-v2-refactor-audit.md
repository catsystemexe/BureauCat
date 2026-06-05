# BureauCat MVP vs V2 Working Model Audit

## Scope and basis

This audit compares the currently implemented BureauCat repository with:

- the authoritative MVP specification in `docs/bureaucat-mvp-v1.2.md`; and
- the proposed V2 working model in `docs/architecture/bureaucat-v2-working-model.md`.

It is an architecture and refactor assessment, not an implementation plan with final schemas. Where the V2 document does not define persistence details, this report identifies likely options and open decisions rather than treating assumptions as requirements.

## 1. Executive summary

### What currently works

The implementation has a coherent MVP foundation:

- `Case` is the top-level aggregate with `draft`, `active`, and `closed` statuses.
- `JournalItem` provides a structured, user-visible case model across Situation/Description, Goals, Risks, Questions, and Strategy.
- Documents are stored as case-level evidence and can be uploaded, listed, and opened in the right panel.
- Chat messages are persisted per case and the middle panel functions as a consultation workspace.
- AI-created Journal changes are mediated by `AISuggestion`; approval creates a `JournalItem`, while rejection preserves the non-authoritative nature of AI output.
- AI response and suggestion payloads are validated before persistence or approval.
- The desktop three-panel shell already broadly matches the V2 spatial concept: overview on the left, consultation in the middle, and contextual detail on the right.
- Evidence metadata, source links, and conflict-capable evidence states create a useful base for V2 traceable insights.
- Meeting preparation is generated as a transient response rather than a database entity, which can later fit under the V2 Strategy tab.

The current implementation is therefore not a throwaway. Its strongest reusable parts are the `Case`, `Document`, `ChatMessage`, and suggestion-approval foundations, plus the three-panel workspace and source-link presentation.

### What conflicts with the V2 model

The central conflict is the unit of ownership:

- The MVP implementation treats one `Case` as one situation and attaches Journal items, documents, messages, and suggestions directly to the case.
- V2 makes `Case` a container for one or more evolving `Situation` records, with each situation owning a user layer and an AI layer.

Additional conflicts follow from that difference:

- There is no `Situation` entity, situation lifecycle, ordering, or active-situation selection.
- The user-authored and AI-authored layers are mixed inside generic `JournalItem` records. V2 distinguishes user-managed description/goals/documents from AI-managed analysis/insights/questions/risks/action plan.
- The current left panel is a full Journal grouped into five sections; V2 calls for a concise case/situation overview containing seven categories.
- The right panel is mode-driven (`help`, `evidence`, `document`), not tab-driven (`Documents`, `Poznatky`, `Strategie`).
- Documents belong only to a case and cannot be associated with one or multiple situations.
- Goals are generic Journal items with `active`, `resolved`, and `obsolete` statuses rather than V2's `active`, `completed`, and `archived` goal semantics.
- Analysis and insights have no first-class representation. Current FACT/CLAIM items are only a partial semantic match for V2 insights.
- Questions, risks, actions, and strategy are generic Journal categories rather than situation-scoped AI outputs with explicit review behavior.
- `AISuggestion` can propose only a Journal-item-shaped payload and is not typed by target entity or AI output category.
- The current AI implementation is a mock that produces a single open-question suggestion. Document extraction is implemented only for TXT; other accepted formats are stored but not extracted.
- Evidence-state recalculation exists only as a placeholder integration point and does not yet compare content with sources.

### Biggest refactor risks

1. **Preserving the authoritative working model.** V2 says the user owns the situation while AI owns a proposal layer. A careless redesign could allow AI to overwrite user-authored situation data, violating both MVP safety rules and V2 principle 2.
2. **Migrating case-level data into situations.** Existing records have no reliable signal for splitting one case into multiple historical situations. Automatic semantic splitting would be unsafe; the migration needs a deterministic default situation and possibly later user-assisted reclassification.
3. **Avoiding duplicate sources of truth.** Keeping Journal sections while adding separate goals, insights, risks, and actions could produce two competing models unless ownership and compatibility boundaries are explicit.
4. **Modelling situation evolution.** V2 says situations arise over time but does not define whether a new situation supersedes, snapshots, branches from, or simply follows the previous one. This affects schema, navigation, AI context, and migration.
5. **Evolving `AISuggestion`.** The current approval transaction is safe but tied to `JournalItem`. Generalizing it for goals and AI-layer outputs risks creating an untyped JSON queue or category-specific workflow inconsistencies.
6. **Document linkage and source traceability.** Situation links must not break case-level document access or existing source links. A document may plausibly support several situations, which argues against a simple `situation_id` column unless the product explicitly limits documents to one situation.
7. **UI density.** V2 adds more categories to the left and three substantial tabs to the right. Showing every record everywhere would conflict with V2's instruction not to overwhelm the user.

## 2. Current implemented model

### Case

Implemented in `prisma/schema.prisma` and exposed through case API routes and services.

Current fields:

- `id`
- `title`
- `area` (optional)
- `status` (`draft`, `active`, `closed` by convention and validation)
- `created_at`
- `updated_at`

Current relationships:

- many `Document` records
- many `JournalItem` records
- many `ChatMessage` records
- many `AISuggestion` records

Current behavior:

- New cases are always created as `draft`.
- Cases can be listed, retrieved, and patched.
- There is no separate intake entity, consistent with MVP v1.2.
- The schema has no `Situation` relationship; the case itself is effectively the current situation container.

### JournalItem

`JournalItem` is the implemented authoritative case-model record.

Current fields:

- case ownership through `case_id`
- section: `description`, `goals`, `risks`, `open_questions`, or `strategy`
- item type: `FACT`, `CLAIM`, `GOAL`, `QUESTION`, `ACTION`, or `RISK`
- `title`, optional `value`, optional `explanation`
- evidence state: `verified`, `inferred`, `unverified`, or `conflict`
- status: `active`, `resolved`, or `obsolete`
- `display_order`
- `source_links_json`
- timestamps

Current behavior:

- Items are listed case-wide and grouped by section in the left panel.
- Users can patch items; deletion is implemented as marking an item `obsolete`.
- Approval of an AI suggestion creates a new Journal item transactionally.
- Evidence-state recheck is invoked after edits, approvals, and document upload, but the current service is a placeholder and leaves values unchanged.
- The UI already labels the `description` section as **Situace**, but this is only a presentation rename. It remains a collection of case-level Journal items, not a V2 `Situation` entity.

### Document

Documents are case-level evidence.

Current fields:

- `id`
- `case_id`
- `filename`
- `filetype`
- `original_file` storage path
- optional `extracted_text`
- optional `ai_summary`
- `created_at`

Current behavior:

- The upload UI accepts PDF, DOCX, TXT, JPG/JPEG, and PNG.
- Original files are stored and records are persisted.
- TXT extraction is implemented with a 10,000-character cap.
- Extraction/OCR for PDF, DOCX, and images is not implemented; these files receive placeholder summaries.
- Documents can be listed and opened from the right panel.
- A Journal item's source-link JSON can contain a document identifier, enabling navigation to that document.
- There is no document description field, email-specific representation, situation relationship, or explicit join table.

### ChatMessage

Chat is persisted as case-level consultation history.

Current fields:

- `id`
- `case_id`
- `role`
- `content`
- `created_at`

Current behavior:

- Messages are listed chronologically per case.
- Sending a message builds AI context from the case, compact Journal, document summaries/excerpts, the last ten messages, and the current message.
- User and assistant messages are saved.
- Intake can use the same message store, consistent with MVP v1.2, although no explicit intake-state orchestration is evident in the current data model.
- Messages are not scoped to a situation, so V2 consultation history cannot currently distinguish which situation was active.

### AISuggestion

`AISuggestion` is the safety boundary between AI output and the authoritative Journal.

Current fields:

- `id`
- `case_id`
- status: `pending`, `approved`, or `rejected`
- `suggested_item_json`
- optional `assistant_reply`
- timestamps

Current behavior:

- Suggested JSON is validated against a Journal-item schema.
- Approval supports as-is and edit-then-approve flows.
- Approval atomically marks the suggestion approved and creates a Journal item.
- Rejection changes only the suggestion status.
- The current mock AI creates an open-question suggestion derived from the latest user message.

Current limitation for V2:

- The record does not identify a situation, target entity, target record, output category, or operation (`create`, `update`, `archive`, etc.). It assumes every approved suggestion becomes a new `JournalItem`.

### UI panels

#### Left panel

- Renders the Journal as the primary model.
- Shows sections labelled **Situace**, **Cíle**, **Rizika**, **Otázky**, and **Postup**.
- Displays individual items with type, value, evidence state, and status.
- Selecting an item opens its evidence detail in the right panel.

#### Middle panel

- Renders consultation/chat.
- Loads persisted messages and pending suggestions.
- Supports composing messages, approving/rejecting suggestions, and generating meeting preparation.
- This is already close to the V2 **Konzultace** role.

#### Right panel

- Always includes document upload.
- Uses internal modes rather than visible tabs:
  - default/help mode with document list;
  - evidence mode for a selected Journal item;
  - document mode for document details.
- Document detail shows summary, extracted text, and original storage path.
- There are no dedicated **Poznatky** or **Strategie** tabs.

## 3. V2 target model

### Case

In V2, `Case` remains the highest organizational unit but changes meaning from “one solved situation” to a container for:

- case title;
- one or more situations;
- a case-level document collection;
- consultation history.

The existing case lifecycle may remain useful, but V2 does not explicitly redefine status transitions or intake activation. Those MVP rules should be retained unless a later authoritative specification changes them.

### Situation

`Situation` becomes the basic working unit.

Each situation represents the current state of the case at a particular phase and contains:

- user-managed description;
- goals;
- related documents;
- AI-managed analysis;
- insights;
- questions;
- risks;
- action plan.

Likely structural needs, subject to product decisions:

- case ownership;
- title or short label for navigation;
- user-authored description;
- ordering or sequence within the case;
- lifecycle/currentness marker;
- timestamps;
- optional relationship to a prior situation if V2 requires explicit evolution lineage.

A key unresolved semantic question is whether editing a situation refines the same record or whether material changes create a new situation. The V2 examples support both refinement and successive situations but do not specify the threshold.

### Goals

Goals are a user-layer collection attached to a situation.

V2 goal states are:

- active;
- completed;
- archived.

Completed goals remain visible in case history. Goals can be added over time. This is more specific than the current generic Journal status model and likely merits either a dedicated entity or a strongly typed compatibility layer.

### Documents

Documents remain evidence, but V2 makes them relevant to a particular situation while also describing a case-level document list.

The safest interpretation is:

- the document file and extracted content remain owned by the case;
- situations link to relevant documents through a relation;
- the same document may be linked to more than one situation;
- insights cite the underlying document/source, not merely the situation-document link.

V2 also mentions a document name, short description, content, and automatically extracted text. The current `filename`, `ai_summary`, and `extracted_text` partially cover this, but a user-controlled description and richer email/content handling may be needed.

### AI layer: analysis, insights, questions, risks, action plan

The V2 AI layer is situation-scoped and reviewable by the user.

- **Analysis:** a concise current interpretation of the situation. This may be a versioned/generated text artifact rather than a list item.
- **Insights:** source-traceable facts learned from documents or consultation. Current FACT/CLAIM Journal items and source links are the closest reusable structure.
- **Questions:** missing or unclear information, with open/answered state.
- **Risks:** possible negative consequences, with active/resolved state.
- **Action plan:** ordered recommended steps. It is advisory, not binding.

V2 says users may approve, edit, or reject AI outputs. Therefore the existing suggestion gate should be preserved conceptually even if the persistence target changes. AI must not directly overwrite the user-owned situation or goals.

### Right panel tabs: Documents / Poznatky / Strategie

The V2 right panel has three stable tabs:

1. **Documents**
   - document list;
   - upload/open behavior;
   - document content and extracted text.
2. **Poznatky**
   - drafted/approved insights;
   - insight details;
   - source traceability.
3. **Strategie**
   - detailed analysis;
   - recommendations;
   - action plan;
   - meeting preparation.

The tab model is a structural change from the current context-mode switch. Evidence detail should likely become part of **Poznatky** or open contextually within **Documents**, rather than remain a separate unnamed mode.

## 4. Mapping table

| Current object / feature | V2 target | Action | Notes |
|---|---|---|---|
| `Case` | Case container | **Keep** | Retain identity, title, timestamps, and likely status/area; add relationship to situations. |
| Case as the single situation | Case with one or more situations | **Split** | Create a default situation for migrated cases; stop using Case itself as the working-state record. |
| `Case.area` | Case metadata | **Keep** | V2 is silent on area. Keep for compatibility unless a later product decision removes it. |
| Case status `draft/active/closed` | Case lifecycle | **Keep** | V2 does not conflict with the MVP lifecycle; do not invent situation statuses from case statuses. |
| Journal section `description` labelled “Situace” | Situation description | **Replace** | Migrate/compose existing description items into the initial situation while preserving provenance. |
| Journal section `goals` / GOAL items | Situation goals | **Move / Split** | Move to situation ownership and map statuses to active/completed/archived; retain source/history metadata where useful. |
| Journal section `risks` / RISK items | AI risks | **Move** | Scope to situation and preserve active/resolved semantics. Decide whether user-created risks share the same entity with an origin field. |
| Journal section `open_questions` / QUESTION items | AI questions | **Move** | Scope to situation; map `resolved` to answered and preserve evidence/source links. |
| Journal section `strategy` | Analysis + action plan + Strategy tab | **Split** | Separate narrative analysis/recommendation from ordered actions and meeting preparation. |
| FACT Journal items | Insights | **Rename / Move** | Strong semantic match when source-traceable; scope to situation. |
| CLAIM Journal items | Insights or user statements | **Split** | Claims are not necessarily facts. Preserve claim/evidence semantics rather than silently relabeling all claims as insights. |
| ACTION Journal items | Action plan steps | **Move** | Scope to situation and add stable ordering and completion/review semantics if approved by product. |
| Generic `JournalItem` | User layer plus AI outputs | **Split** | Avoid one unrestricted table being both user truth and AI layer unless discriminators and ownership rules are explicit. |
| Journal evidence state | Insight/source confidence | **Keep** | Valuable V2 capability; V2 requires source traceability even though it does not name evidence states. |
| `source_links_json` | Insight sources | **Replace** | Migrate toward structured source records/relations; JSON may remain during transition. |
| Journal item status `active/resolved/obsolete` | Goal/question/risk/action-specific states | **Split** | Different V2 categories have different lifecycle terms and should not rely on one ambiguous enum. |
| `Document` | Case document linked to situations | **Keep / Move** | Keep file record case-owned; add many-to-many situation linkage and likely description metadata. |
| Document `ai_summary` | Document summary / strategy context | **Keep** | Keep as generated metadata, but do not confuse it with situation analysis. |
| TXT-only extraction | V2 document content/extraction | **Replace** | Complete supported extraction/OCR separately; not a prerequisite for the Situation schema refactor. |
| `ChatMessage` | Consultation history | **Keep** | Keep case ownership; add optional situation context so historical consultation can be interpreted correctly. |
| Intake messages in Chat | Initial consultation | **Keep** | Continue storing intake as messages; initial approved output should populate the first situation rather than case-level Journal sections. |
| `AISuggestion` targeting Journal item JSON | Review gate for V2 AI outputs | **Replace / Split** | Add situation, target kind, operation, and typed payload; retain pending/approved/rejected workflow. |
| Suggestion approve/edit/reject UI | V2 AI review behavior | **Keep** | Reuse the interaction pattern for insights, questions, risks, action plans, and assisted user-layer edits. |
| Mock chat AI | Situation-aware AI service | **Replace** | Context should include active situation, goals, linked documents, approved AI outputs, and recent consultation. |
| Compact case-wide Journal AI context | Situation-scoped context assembly | **Replace** | Avoid mixing historical situations into the active situation without explicit summaries. |
| Meeting preparation transient response | Strategy tab content | **Move** | Keep it non-persistent unless later specified; render under Strategy. |
| Left Journal panel | Case/situation overview | **Replace** | Preserve navigation patterns but lead with situations and concise current-situation summaries. |
| Middle Chat panel | Consultation | **Rename / Keep** | Functionally aligned; make active situation context visible. |
| Right default document list | Documents tab | **Move** | Becomes one explicit right-panel tab. |
| Right evidence mode | Poznatky detail/source view | **Move** | Integrate insight list/detail and source navigation into the Poznatky tab. |
| Right document mode | Documents detail | **Keep / Move** | Keep behavior within the Documents tab instead of replacing the whole panel mode. |
| Right help mode | Empty/tab states | **Replace** | Each tab should own a clear empty state; no separate architectural mode is needed. |
| No right-panel tabs | Documents / Poznatky / Strategie | **Replace** | Introduce stable tabs and retain contextual selection inside each tab. |
| Evidence-state placeholder service | Real source consistency checks | **Replace** | Implement after structured source relations are stable; do not build matching against a schema about to change. |

## 5. Data model implications

### What new entities are likely needed

The minimum likely addition is:

#### `Situation`

Potential fields:

- `id`
- `case_id`
- short label/title
- user-authored description
- display/sequence order
- current/archive marker if required
- `created_at`
- `updated_at`

The exact lifecycle and lineage fields must wait for answers to the open questions in section 8.

Other likely entities or typed records:

#### `Goal`

A dedicated goal entity is preferable if goals need category-specific status and historical visibility.

Potential fields:

- `id`
- `situation_id`
- text/title
- status (`active`, `completed`, `archived`)
- display order
- timestamps
- optional origin/provenance metadata

#### `SituationDocument`

A join entity is preferable to putting one `situation_id` on `Document`, because case-level documents can plausibly remain relevant across situation changes.

Potential fields:

- `situation_id`
- `document_id`
- optional relationship note or ordering
- timestamp

#### AI output records

There are two viable designs:

1. Separate entities such as `SituationAnalysis`, `Insight`, `SituationQuestion`, `Risk`, and `ActionPlanItem`.
2. A shared `SituationAIItem` with a strict category discriminator and category-specific validated payload/status rules, plus a separate analysis record if analysis is singleton/versioned text.

Separate entities provide clearer constraints and statuses. A shared entity reduces tables but risks recreating the overly generic Journal model. The decision should be driven by editing, ordering, history, and approval requirements—not only schema size.

#### Structured source records

Insights need traceability. Likely options include:

- `InsightSource` linking an insight to a document and quote; and
- a source type for consultation/user statements when no document exists.

This can replace fragile JSON-only source links while retaining the original quote.

### What existing entities can be reused

- **Case:** retain as the aggregate root.
- **Document:** retain file storage, type, extracted text, summary, and case ownership.
- **ChatMessage:** retain consultation history; add optional situation context rather than duplicating messages.
- **AISuggestion workflow:** retain review statuses and transactional approval concept, but evolve the target model.
- **JournalItem during transition:** retain as legacy/compatibility storage until migration is verified. It should not remain indefinitely as a second authoritative model.
- **Evidence state concepts:** retain for source-backed insights and conflicts.

### What migrations may be needed

A safe migration sequence is likely additive first:

1. Create `Situation` and add one initial/default situation per existing case.
2. Add situation linkage to new records and optional `situation_id` to `ChatMessage` and `AISuggestion`.
3. Create goal, AI-output, and source-link structures.
4. Link every existing document to the default situation through `SituationDocument` while retaining `Document.case_id`.
5. Transform existing Journal items by category:
   - description items → initial situation description or preserved description blocks;
   - GOAL items → goals;
   - FACT items → insights;
   - QUESTION items → questions;
   - RISK items → risks;
   - ACTION items → action-plan items;
   - strategy items → analysis/recommendation or action plan after deterministic classification;
   - CLAIM items → preserve as claims/user statements pending explicit mapping.
6. Preserve original IDs in migration metadata or an explicit legacy-reference column so suggestions/source references can be reconciled and the migration can be audited.
7. Update APIs and UI to read the new model, initially with fallback to legacy Journal data if necessary.
8. Stop writes to `JournalItem` only after parity checks.
9. Remove or archive the legacy table and JSON source representation in a later cleanup migration.

Important migration constraints:

- Do not ask AI to decide the initial migration split automatically.
- Do not delete old Journal data in the same release that introduces the new model.
- Do not move documents out of case ownership; situation linkage should be additive.
- Preserve evidence state, original quotes, display order, timestamps where possible, and whether content originated from AI or the user.

## 6. UI implications

### Left panel

The left panel should change from a full Journal editor/list to a concise case overview and navigation surface.

Recommended responsibilities:

- list situations in sequence;
- clearly identify the active/selected situation;
- show concise summaries/counts for:
  - Situation description;
  - Goals;
  - Analysis;
  - Insights;
  - Questions;
  - Risks;
  - Action plan;
- allow navigation between situations without presenting all detail at once.

The current section-card components and badges are reusable, but the panel should avoid rendering every source, explanation, and long value. Detail belongs in the middle or right panel.

### Middle panel

The middle panel remains the primary workspace as **Konzultace**.

Required changes:

- make the selected situation visible near the chat heading/composer;
- scope AI context and new suggestions to that situation;
- distinguish suggestions that update user-owned fields from AI-layer outputs;
- preserve approve, edit, and reject controls;
- provide an explicit flow for creating a new situation versus refining the current one once that product rule is defined.

Case-wide consultation history can remain continuous, but messages should retain the situation context active when they were created.

### Right panel

Replace the implicit `help/evidence/document` mode machine with explicit tabs.

#### Documents

- upload and list case documents;
- filter or mark documents linked to the selected situation;
- open document content without leaving the tab;
- show extracted text and summary;
- allow linking/unlinking to the selected situation only if V2 product behavior confirms user control.

#### Poznatky

- list approved and pending insights for the selected situation;
- show insight state and source;
- open the underlying document;
- retain conflict/verified/unverified indicators where applicable;
- avoid treating unsupported CLAIM records as verified facts during migration.

#### Strategie

- show detailed analysis;
- show recommendations and ordered action plan;
- host meeting preparation;
- keep advisory language clear;
- expose review status for AI-generated material.

### What should become primary

- the selected Situation as the current working unit;
- user-owned description and goals;
- consultation in the middle panel;
- concise, source-aware AI support attached to the selected situation.

### What should become secondary

- raw historical Journal item structure;
- long evidence metadata in the left panel;
- case-wide undifferentiated AI context;
- meeting preparation as a standalone chat card;
- original storage paths and implementation details in the main document UI;
- legacy Journal terminology once migration is complete.

## 7. Suggested refactor phases

### Phase 1: Situation model

Goal: establish the V2 ownership boundary without changing all downstream concepts at once.

- Add `Situation` and case-to-situation ordering.
- Create one default situation for each existing case.
- Define selected/current situation API behavior.
- Decide how situation refinement differs from creation of a new situation.
- Associate new chat messages and suggestions with the selected situation where possible.
- Keep legacy Journal reads operational during this phase.

Exit criterion: every case has at least one selectable situation, and no existing case becomes inaccessible.

### Phase 2: Goals

Goal: move the clearest user-owned collection out of generic Journal storage.

- Add situation-scoped goals.
- Implement V2 statuses: active, completed, archived.
- Migrate GOAL items from the default situation.
- Add user editing and ordering.
- Route AI-assisted goal wording through suggestion approval; AI must not silently modify goals.

Exit criterion: goals are owned by situations and preserve completed history.

### Phase 3: Documents linked to situations

Goal: retain case evidence while making relevance explicit.

- Add `SituationDocument` linkage.
- Link existing documents to the default situation.
- Update document APIs to return case-level and selected-situation relevance.
- Keep source links functional.
- Add a document description only if confirmed as a user-facing V2 requirement.
- Defer advanced extraction/OCR work from the structural migration unless it blocks source traceability.

Exit criterion: one document can be discovered at case level and linked to all relevant situations.

### Phase 4: AI outputs per situation

Goal: implement the V2 AI layer without bypassing user review.

- Define persisted forms for analysis, insights, questions, risks, and action plan.
- Add category-specific statuses and ordering.
- Generalize `AISuggestion` with a typed target and operation.
- Migrate compatible FACT, QUESTION, RISK, ACTION, and strategy records.
- Introduce structured source links for insights.
- Rebuild AI context around the selected situation and linked documents.
- Implement evidence/conflict recalculation only after the new source model is stable.

Exit criterion: all AI output is situation-scoped, validated, traceable where applicable, and reviewable.

### Phase 5: Right panel tabs

Goal: expose the V2 information architecture.

- Add stable **Documents / Poznatky / Strategie** tabs.
- Move document upload/list/detail into Documents.
- Move evidence/insight source detail into Poznatky.
- Move analysis, action plan, recommendations, and meeting preparation into Strategie.
- Preserve contextual navigation from an insight to a document.
- Keep the middle consultation panel primary.

Exit criterion: right-panel navigation no longer depends on hidden `help/evidence/document` modes.

### Phase 6: Cleanup / migration

Goal: remove duplicate models only after data and behavior parity.

- Verify migrated counts and representative records.
- Resolve remaining CLAIM and strategy-item mappings with explicit rules or user review.
- Stop legacy Journal writes.
- Remove compatibility code and obsolete APIs.
- Retire `JournalItem` only when the V2 model fully represents required history and provenance.
- Replace JSON source links with structured relations after migration verification.
- Update terminology, documentation, and tests.

Exit criterion: there is one authoritative user model and one clearly separated, reviewable AI layer.

## 8. Risks and open questions

### UX risks

- **Situation proliferation:** users may not know when to refine a situation versus create a new one.
- **Loss of overview:** seven left-panel categories plus multiple situations can become denser than the current five-section Journal.
- **Review fatigue:** requiring approval for every small AI-generated insight, question, risk, and action may overwhelm users.
- **Tab fragmentation:** related context may be split between Poznatky and Strategie; cross-links and selected-state continuity are important.
- **Ambiguous ownership:** analysis and risks are AI-layer outputs, but users may reasonably want to author or directly edit them. The UI must communicate whether edits create user-owned content or revised approved AI output.
- **Historical comprehension:** when switching situations, users need to understand which goals, documents, and consultation messages belong to the selected phase.

Open UX questions:

1. Who creates a new situation: user, AI suggestion, or both?
2. What event makes one situation current and another historical?
3. Can multiple situations be active at once?
4. Is situation description one editable text or a collection of user statements?
5. Are left-panel categories expandable summaries, counts, or full lists?
6. Does selecting an insight automatically switch the right panel to Poznatky and preserve a route back?

### Data migration risks

- Description Journal items may not combine cleanly into one description without losing item type, source links, or order.
- CLAIM items cannot safely become factual insights without review.
- Generic status mapping is lossy:
  - `resolved` may mean goal completed, question answered, or risk resolved;
  - `obsolete` may map to archived, superseded, or deleted depending on category.
- Strategy items may contain either analysis, recommendation, or an action and cannot always be classified mechanically.
- Existing source JSON is flexible and may contain document names without stable document IDs.
- Existing case-wide chat and suggestions cannot always be attributed to a specific historical situation.
- Existing documents may be relevant to several future situations.

Open migration questions:

1. Should the initial situation description preserve separate blocks or become a single text?
2. Should all existing documents link to the default situation automatically?
3. How long must legacy Journal records remain queryable?
4. Is migration reversible, and what audit report is required before cleanup?

### Scope risks

- V2's word “history” could lead to timeline, versioning, or audit-log work that was explicitly outside MVP v1.2.
- “Email” document support could expand into mailbox integration; the V2 text only establishes email as a document example, not an integration requirement.
- Situation evolution could become workflow management, which V2 explicitly says BureauCat is not.
- Rich strategy features could drift toward legal advice or decision authority, conflicting with the product's analytical-partner role.
- Advanced OCR, precise citation coordinates, notifications, collaboration, mobile optimization, and knowledge graphs should remain out of this refactor unless separately specified.

### Technical risks

- A polymorphic suggestion table can become difficult to validate and transact safely.
- Dual writes to Journal and V2 entities can diverge; prefer additive migration plus a controlled cutover over indefinite synchronization.
- SQLite migration constraints require careful table rebuilds when changing nullability or relations.
- Situation-scoped AI context can grow rapidly if all historical situations and documents are included.
- Structured sources must support both documents and consultation/user statements without weak, unvalidated JSON.
- Current evidence-state checks are placeholders; building them before source normalization risks rework.
- The UI is currently a client-side workspace with several independent fetches. Situation switching may create stale selections unless state and request lifecycles are centralized carefully.

Open technical questions:

1. Does analysis need version history, only the latest approved version, or both?
2. Are AI-layer items persisted only after approval, or are pending drafts first-class records separate from `AISuggestion`?
3. Should `ChatMessage.situation_id` be nullable to support case-wide consultation?
4. Should action-plan steps have completion status, given V2 describes recommendations but does not define step lifecycle?
5. Can one insight cite multiple documents and consultation messages?
6. Is an explicit `origin` (`user`, `ai`, `migration`) required on all migrated/new records?

## 9. Recommendation

### What should be implemented first

Implement the **Situation foundation first**, as an additive and reversible change:

1. Define the situation lifecycle and the rule for “new situation” versus “refine current situation.”
2. Add `Situation` with ordering and one default situation per existing case.
3. Make the selected situation explicit in APIs, AI context, and the workspace header/navigation.
4. Preserve the current Journal as legacy storage during this step.
5. Move goals next because they have clear user ownership and well-defined V2 states.
6. Add situation-document links before rebuilding insights, so the AI layer has a stable evidence boundary.

This order addresses the core V2 change—the working unit—without prematurely redesigning every Journal category or right-panel component.

### What should be postponed

Postpone until the Situation, Goals, and document-link semantics are stable:

- final deletion of `JournalItem`;
- automatic semantic splitting of old cases into multiple situations;
- migration of ambiguous CLAIM and strategy records without user review;
- generalized evidence/conflict recalculation;
- advanced PDF/DOCX/OCR extraction and precise citation mapping;
- analysis version history;
- action-plan workflow features not explicitly required by V2;
- email service integration;
- mobile redesign, collaboration, notifications, timeline, knowledge graph, and other non-V2/MVP scope.

The preferred end state is not “Journal plus V2.” It is a single user-owned Situation model, case-level evidence linked to situations, and a separate situation-scoped AI layer whose outputs remain validated, source-aware, and subject to user approval.
