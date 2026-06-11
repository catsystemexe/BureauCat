# BureauCat

BureauCat MVP v1.2 is a desktop-first workspace for building and maintaining a working case model. The Journal is the authoritative model of the case, documents are evidence, and AI-created Journal changes remain suggestions until the user approves them.

The authoritative product specification is [`docs/bureaucat-mvp-v1.2.md`](docs/bureaucat-mvp-v1.2.md).

## Current app state

The repository currently includes:

- A case list with draft case creation and case detail workspaces.
- A desktop-first three-panel workspace for Journal, Chat, and contextual evidence/document views.
- Journal-related situations, goals, linked documents, Journal item APIs, and evidence-state handling.
- Case document upload, local file storage, normalized document text, original-file access, annotations, highlights, notes, and pins.
- Chat message persistence, a deterministic mock AI response, validated AI suggestions, and approve/reject flows.
- Meeting preparation generated through the existing case workflow rather than a separate database entity.
- Prisma + SQLite persistence, App Router API routes, and Zod validation at domain boundaries.

The current AI integration is a local deterministic mock. It exercises chat and suggestion workflows but is not a production model provider.

## Stack

- TypeScript
- Next.js App Router
- React
- Prisma + SQLite
- Zod
- Python-based MarkItDown conversion helper

## Getting started

### Prerequisites

- Node.js and npm
- Python 3 for document conversion
- The Python packages imported by `scripts/convert_with_markitdown.py` when using the corresponding formats (`markitdown`, `striprtf`, `rapidocr-onnxruntime`, and `pdf2image`)
- Poppler when PDF rasterization/OCR is required by the local environment

The repository does not currently provide a Python dependency lockfile, so document conversion capabilities depend on the packages installed in the runtime environment.

### Run locally

1. Install JavaScript dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

3. Generate the Prisma client:

   ```bash
   npm run prisma:generate
   ```

4. Apply the existing migrations:

   ```bash
   npm run db:deploy
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open <http://localhost:3000>. The root route redirects to the case list at `/cases`.

`MARKITDOWN_PYTHON` can be set to select a Python executable other than `python3`.

## MarkItDown support matrix

This matrix describes the current user-facing document behavior:

| Format | Current support |
| --- | --- |
| TXT | OK |
| MD | OK |
| RTF | Normalized view + external original |
| DOCX | Normalized view + external original |
| PDF | OK |
| PNG | Placeholder |
| HTML | Not implemented |

Uploaded originals are stored under `data/uploads/`, which remains ignored by Git except for its directory placeholder.

## Available commands

```bash
npm run dev
npm run build
npm run start
npm run typecheck
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate
npm run db:deploy
```

There is currently no automated test suite or `npm test` script. The primary repository checks are:

```bash
git diff --check
npm run typecheck
npm run build
```

## MVP boundaries

- Journal is the authoritative working case model; Chat is a workspace, not memory.
- Documents provide evidence and may reveal conflicts with the Journal.
- AI never writes directly to the Journal. AI-created changes go through `AISuggestion` approval.
- Description is represented by Journal items in the `description` section, not by a Case description field.
- Intake is stored as chat messages, and meeting preparation is not a database entity.
- Mobile optimization remains outside MVP v1.2.
