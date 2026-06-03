# BureauCat

BureauCat MVP v1.2 is a desktop-first case model workspace. This repository currently contains the minimal TypeScript Next.js App Router scaffold for Task 1.

## Stack

- TypeScript
- Next.js App Router
- Prisma + SQLite
- Zod for future AI JSON validation

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

3. Generate Prisma client:

   ```bash
   npm run prisma:generate
   ```

4. Run the development server:

   ```bash
   npm run dev
   ```

5. Open http://localhost:3000.

## Available checks

```bash
npm run typecheck
npm run build
```

## Current scope

Implemented so far:

- Minimal Next.js App Router shell
- Prisma SQLite configuration without domain models
- Zod dependency for future schema validation
- Smoke-test homepage
- Desktop-first global CSS placeholder
- Folder placeholders for the approved MVP structure

Deferred until later tasks:

- Case, Document, JournalItem, ChatMessage, and AISuggestion Prisma models
- API routes
- Domain services
- AI prompts and validation schemas
- Document upload/extraction
- Evidence Panel behavior
- Meeting Preparation endpoint
