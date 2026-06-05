# BureauCat V2 Refactor Decisions

This document is the implementation decision contract extracted from the BureauCat V2 working model and refactor audit. It records only the decisions needed to sequence the refactor; unresolved design details remain postponed.

## 1. Core decisions

1. Case remains the top-level container.
2. Situation becomes the primary working unit.
3. Every Case must have at least one Situation.
4. Existing cases will get one default Situation during migration.
5. Situation is user-owned.
6. Situation contains a user-managed description.
7. Goals become user-managed and situation-scoped.
8. Goals should eventually be a separate entity.
9. Documents remain case-level files.
10. Documents can be linked to Situations.
11. Situation-document linking should use a join table, not a single `situation_id` on Document.
12. JournalItem becomes temporary legacy / compatibility storage.
13. AI outputs become situation-scoped.
14. AI outputs remain reviewable; AI must not directly overwrite user-owned Situation or Goals.
15. The AISuggestion workflow should be preserved conceptually but later generalized beyond JournalItem.
16. The right panel target tabs are Documents / Poznatky / Strategie.
17. Chat / Konzultace remains the central working interaction.
18. The next implementation step is Situation foundation only.

## 2. Non-decisions / postponed

The following are explicitly not decided yet:

- Final AI output schema.
- Whether Analysis is versioned.
- Whether Action Plan items have completion status.
- Final source-link schema.
- Full JournalItem removal.
- PDF / OCR / MarkItDown pipeline.
- Mobile layout.
- Multi-user / collaboration.
- Timeline / history system.

## 3. Refactor order

1. **Phase 1: Situation foundation**
2. **Phase 2: Goals**
3. **Phase 3: Situation-document linking**
4. **Phase 4: AI outputs per situation**
5. **Phase 5: Right panel tabs**
6. **Phase 6: Legacy Journal cleanup**

## 4. Guardrails

- Do not maintain two long-term authoritative models.
- Do not let AI write directly to user-owned data.
- Use additive migrations first.
- Keep the existing MVP working during the transition.
- Do not perform a large-bang rewrite.
- Preserve data before removing legacy structures.
