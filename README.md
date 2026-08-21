# AI CRM Agent

An AI sales-operations employee that sits on top of HubSpot: it watches your pipeline, flags deals that need attention, explains why with evidence, and proposes actions you approve before anything executes. See `docs/Master Prompt — AI CRM Agent SaaS.md` for the full product spec.

## Stack

- **Framework**: Next.js (App Router, TypeScript), deployed to Vercel
- **Database**: PostgreSQL (Neon in production) via Prisma 7 with the `pg` driver adapter
- **Auth**: Auth.js (credentials provider, JWT sessions)
- **AI**: OpenRouter
- **Tests**: Vitest

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the env template and fill in real values:
   ```bash
   cp .env.example .env
   ```
   For local development you can run Postgres in Docker instead of Neon:
   ```bash
   docker run -d --name ai-crm-agent-db -e POSTGRES_PASSWORD=devpassword -e POSTGRES_DB=aicrmagent -p 55432:5432 postgres:16-alpine
   ```
   and point `DATABASE_URL`/`DIRECT_URL` at `postgresql://postgres:devpassword@localhost:55432/aicrmagent?schema=public`.
3. Generate an `AUTH_SECRET`:
   ```bash
   openssl rand -base64 32
   ```
4. Apply the database schema:
   ```bash
   npx prisma migrate dev
   ```
5. Start the dev server:
   ```bash
   npm run dev
   ```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run test` | Vitest unit tests |
| `npx prisma studio` | Browse the database |
| `npx prisma migrate dev` | Apply schema changes locally |

## Project structure

```
src/
  app/            App Router routes (auth pages, /w/[workspaceSlug]/* dashboard, /api/*)
  components/     UI primitives and dashboard components
  lib/            Auth, authorization, db client, validation, business logic
  generated/      Prisma client output (generated, not committed)
prisma/
  schema.prisma   Database schema
  migrations/     Migration history
docs/             Product spec and workflow docs
```

## Security notes

- Authorization is enforced server-side in `src/lib/authz.ts` — a workspace id in a URL is always re-verified against the authenticated user's actual membership, never trusted from the client.
- `src/proxy.ts` (Next.js Edge middleware) only handles session-presence redirects and never touches the database — the Edge runtime can't load Prisma. Real authorization happens in route handlers and layouts, which run on the Node runtime.
- Secrets live in `.env` (gitignored). `.env.example` documents required variables without real values.
