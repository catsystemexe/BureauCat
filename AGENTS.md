# BureauCat – Agent Instructions
## Project goal
Build BureauCat MVP v1.2: a desktop-first case model app with Journal, Chat, Documents, AI Suggestions and Evidence Panel.
## Core rules
- Do not expand scope beyond MVP v1.2.
- Journal is the authoritative working model of the case.
- Documents are evidence.
- AI never writes directly to Journal.
- All AI-created journal changes must go through AISuggestion.
- Chat is a workspace, not memory.
- Description is not a Case field; it is a collection of JournalItems in section "description".
- Meeting preparation is not a database entity.
- Intake is stored as ChatMessages.
- Case starts as draft and becomes active after intake completion.
- Mobile optimization is out of scope.
## Tech expectations
- Prefer TypeScript.
- Keep code simple.
- Use Prisma + SQLite for MVP.
- Validate AI JSON before saving suggestions.
- Do not introduce new dependencies without clear reason.
- After changes, run available tests/build checks.
