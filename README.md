# ALDMS — Architect Liaison Document Management System

Multi-tenant SaaS portal for Indian architecture/liaison firms to collect
statutory documents from clients via checklists, chase them automatically,
and track progress. Full build spec: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

## Local development

No external services needed — everything runs on mocks locally:

| Piece | Local dev | Production |
|---|---|---|
| Database | PGlite (embedded Postgres) at `.data/pglite` | Supabase Mumbai via `DATABASE_URL` |
| File storage | Disk at `.data/storage` via signed local URLs | Cloudflare R2 (`STORAGE_BACKEND=r2`) |
| SMS / WhatsApp / OTP | Console log (`🔐 [DEV OTP …]` in terminal) | MSG91 |
| Email | Console log | Resend |
| Rate limiting | In-memory | Upstash Redis |

### First run

```bash
npm install
npm run db:migrate   # creates .data/pglite and applies schema
npm run db:seed      # demo firms, staff, clients, library, templates
npm run dev          # http://localhost:3000
```

### Demo logins

Staff (email + password tab) — password for all: `Password@123`

| Email | Role |
|---|---|
| owner@platform.test | Platform owner |
| admin@deshpande.test | Firm admin (Deshpande & Associates, gold) |
| priya@deshpande.test | Associate |
| amit@deshpande.test | Associate |
| admin@mehta.test | Firm admin (Mehta Liaison Services, silver) |

Clients (phone + OTP tab — the OTP is printed in the `npm run dev` terminal):

| Phone | Notes |
|---|---|
| 98765 43210 | Suresh Patil — client of BOTH firms → exercises the account picker |
| 98123 45678 | Anita Sharma — Hindi language preference |

### Scripts

| Script | What |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build + typecheck |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run db:generate` | Generate SQL migration from schema changes |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed demo data (idempotent — skips if seeded) |

To reset the local database: stop the dev server, delete `.data/`, then
`npm run db:migrate && npm run db:seed`.

## Environment

Copy `.env.example` → `.env`. Only `AUTH_SECRET` is needed locally (one was
generated during setup); provider keys switch modules from mock to real
drivers. Production deployment (Vercel Mumbai + Supabase + R2 + MSG91 +
Razorpay) is covered by IMPLEMENTATION_PLAN.md §9–10 and is not wired yet.
