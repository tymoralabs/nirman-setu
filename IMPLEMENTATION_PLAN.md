# Implementation Plan — Architect Liaison Document Management System (ALDMS)

> **Audience:** This document is a complete, self-contained build specification. An AI coding agent (or human developer) should be able to implement the entire system from this file alone, without access to any prior conversation.
>
> **Market:** India. All product, compliance, UX, and infrastructure decisions assume Indian architecture/construction-liaison firms and their clients. See §9 for rationale, §10 for operations.

---

## 1. Product Summary

A multi-tenant SaaS web portal for Indian architecture (construction liaison) firms to collect legal/statutory documents from their clients via structured checklists, chase them automatically, and track progress until every document is received.

**Core workflow:**
1. A firm's **Chief Architect (Firm Admin)** creates staff logins (**Associate Architects**), creates **Projects**, and allocates projects to associates.
2. The firm maintains a reusable **Checklist Item Library** (master list of document types: "Sale Deed", "7/12 Extract", "NA Order"…) and reusable **Checklist Templates** (e.g., "New Bungalow — Initial Docs" = 14 preset items).
3. An associate composes a **Checklist** for a project from a template or by picking library items (plus ad-hoc items).
4. The associate (or admin) creates a **Client login** and sends the checklist to the client (WhatsApp + SMS + email notification).
5. The **Client** logs in with **phone number + OTP** (no password), sees pending checklists, and uploads documents against each item — from phone camera or file picker, all at once or incrementally over days.
6. **Associates can also upload on a client's behalf** — many clients hand over paper at the office; the associate scans/photographs and uploads against the same checklist. The product must work even when the client never logs in.
7. The system **auto-reminds** the client about pending items on a schedule the associate controls.
8. The associate reviews uploads, downloads documents, and marks each item **Received** (or **Rejected** with a plain-language reason, prompting re-upload). If a client genuinely cannot produce a document, the associate can mark the item **Waived** (with note) so the checklist can still complete honestly. Items can also be flagged **Hard Copy Received** — liaison work involves physical originals.
9. Multiple sequential checklists per project (e.g., "Initial Documents", "Post-Sanction Documents", "Completion/OC Documents").
10. Dashboards show per-project / per-client progress for admins and associates, highlighting "stuck" clients needing follow-up.
11. Firm Admin can do everything an associate can do, across all projects.
12. Platform subscription tiers (Silver / Gold / Platinum) gate limits per firm; billing in INR with GST invoices via Razorpay.

**Two levels of "admin" — do not confuse:**
- **Platform Owner** (us): operates the SaaS, manages firm subscriptions, provides support.
- **Firm Admin** (Chief Architect): admin *within* one tenant/firm.

**Personas — design for these, not for developers:**
- *Chief Architect*: 45–60, moderately tech-comfortable, wants one screen answering "which projects are stuck and why".
- *Associate*: 25–35, does the chasing; today uses WhatsApp forwards and Excel. The product must be faster than that or they revert.
- *Client*: 30–70, **phone-only for many, no smartphone habit for some**, variable English comfort, patchy mobile data. Photographs paper documents with phone camera. Zero tolerance for passwords or big-screen-only UIs. **The client portal is a mobile-first product** — and the associate-upload path (workflow step 6) covers clients who never touch it.

---

## 2. Tech Stack (fixed — do not substitute)

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 15+ (App Router, TypeScript)** | Single repo, server actions + route handlers |
| UI | **Tailwind CSS + shadcn/ui** | Client portal built mobile-first |
| i18n | **next-intl** | v1: English + Hindi for *client portal only*; firm side English. String files structured so Marathi/Gujarati/Tamil are file-drops later |
| Database | **PostgreSQL via Supabase — Mumbai region (ap-south-1)**, Pro plan (PITR backups, §10.1) | Data residency + latency. Region non-negotiable |
| ORM | **Drizzle ORM** | Migrations via drizzle-kit |
| Auth (staff) | **Auth.js (NextAuth v5)** Credentials — email + password, bcrypt cost 12, JWT | Firm admin, associates, platform owner |
| Auth (clients) | **Phone + OTP** (custom credentials provider; OTP via MSG91) | 6-digit, 5-min expiry, 3 verify attempts, 30 s resend cooldown. No client passwords. Multi-firm account picker (§5.1) |
| File storage | **Cloudflare R2, location hint `apac`** (S3 API via `@aws-sdk/client-s3`) | Private bucket, presigned PUT/GET. **Storage module must be backend-agnostic from day one** — alternate AWS S3 ap-south-1 driver for firms demanding India-only storage |
| Notifications | **MSG91** (SMS + WhatsApp Business API) + **Resend** (transactional email) | Client-facing: WhatsApp → SMS → email fallback. DLT + Meta template approval required — **start registration at Phase 0** (§9.4) |
| Rate limiting | **Upstash Redis** (`@upstash/ratelimit`) | Serverless-safe; in-memory fallback for dev/test |
| Monitoring | **Sentry** (client + server) + Vercel Analytics + external uptime check on `/api/health` | §10.2 |
| Billing | **Razorpay Subscriptions** (UPI Autopay, cards, netbanking) | INR, GST invoices. Abstract behind `billing/` module |
| Image handling | **browser-image-compression** (client-side) + **pdf-lib** (server-side merge/watermark) | Camera photos compressed before upload; multi-photo → single PDF |
| Validation | **Zod** everywhere (forms, API, env) | |
| Testing | **Vitest** + **Playwright** (incl. mobile viewport) | All external providers behind mock drivers — suite runs offline |
| Deployment | **Vercel** (functions region `bom1` Mumbai) + Supabase Mumbai + R2 | Crons scheduled in UTC: 10:00 IST = **04:30 UTC** |

**Environment variables** (validate at boot with Zod in `src/env.ts`):

```
DATABASE_URL=
AUTH_SECRET=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
STORAGE_BACKEND=r2            # r2 | s3 (India-resident alternate)
MSG91_AUTH_KEY=
MSG91_SMS_TEMPLATE_OTP=       # DLT-approved template IDs
MSG91_SMS_TEMPLATE_NOTICE=
MSG91_WA_NUMBER=
RESEND_API_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
SENTRY_DSN=
NEXT_PUBLIC_APP_URL=
CRON_SECRET=                  # protects Vercel cron endpoints
```

---

## 3. Roles & Permission Matrix

Four roles. Role stored on `users`, embedded in JWT.

| Capability | PLATFORM_OWNER | FIRM_ADMIN | ASSOCIATE | CLIENT |
|---|---|---|---|---|
| Manage firm subscriptions/plans | ✅ | — | — | — |
| Platform metrics; **read-only "view as firm" support mode** (banner shown, every access logged) | ✅ | — | — | — |
| Create/disable associate logins | — | ✅ | — | — |
| Create/edit projects; allocate to associates | — | ✅ | — | — |
| Manage library + templates | — | ✅ | ✅ | — |
| Create client logins (incl. second login for same client entity — co-owners) | — | ✅ | ✅ | — |
| Create/send checklists, set reminder cadence | — | ✅ (any project) | ✅ (allocated only) | — |
| Review/download/mark documents; waive items; hard-copy flag; **upload on client's behalf** | — | ✅ (any project) | ✅ (allocated only) | — |
| Soft-delete documents (30-day trash, restorable) | — | ✅ | ✅ (allocated) | — |
| Add item comments visible to client | — | ✅ | ✅ | — |
| Upload documents, reply to comments | — | — | — | ✅ (own checklists only) |
| View firm dashboard | — | ✅ (all) | ✅ (allocated only) | — |
| View own checklist progress | — | — | — | ✅ |
| Firm-level data export; per-client export/delete (DPDP) | — | ✅ | — | — |

**Enforcement rule (critical):** every query and mutation filters by `firmId` (tenant isolation) AND role scope (associate → allocated projects; client → own client record). Centralize in `src/lib/authz.ts` — never inline ad-hoc checks. Authz test matrix is a Phase 7 gate. Support "view as firm" is read-only: it reuses the same service layer with a `supportReadOnly` session flag that rejects all mutations.

---

## 4. Data Model

Drizzle schema. All tables: `id` (uuid pk), `createdAt`, `updatedAt`. All firm-scoped tables carry indexed `firmId`. Timestamps stored UTC, **displayed IST** via single helper (`dates.ts`).

```
firms
  id, name, slug (unique), status: active|suspended|pending_deletion
  gstin (nullable, validated format), billingAddress, state (GST place-of-supply)
  planTier: silver|gold|platinum
  planStatus: trialing|active|past_due|cancelled|expired
  trialEndsAt, readOnlySince (nullable), deleteAfter (nullable)   -- lifecycle §9.10
  razorpaySubscriptionId (nullable)
  storageUsedBytes (bigint, default 0 — mutate only via SQL increment/decrement, never read-modify-write)
  grievanceEmail (nullable — DPDP contact)

users
  id, firmId (nullable — null only for PLATFORM_OWNER)
  role: platform_owner|firm_admin|associate|client
  name, email (nullable for clients), phone (E.164; required for clients)
  passwordHash (nullable — null for OTP-only clients)
  preferredLanguage: en|hi
  clientId (nullable, FK → clients.id when role=client)
  status: invited|active|disabled
  lastLoginAt
  -- CONSTRAINTS:
  --   staff (role != client): email NOT NULL, UNIQUE(email) globally — staff log in by email
  --   clients: UNIQUE(firmId, phone) — same phone MAY exist as a client in multiple firms;
  --            OTP login resolves phone → all matching active client users → account picker (§5.1).
  --   Multiple client users may share one clientId (spouse/co-owner logins).

otp_codes
  id, phone, codeHash, purpose: login, expiresAt, attempts (int), consumedAt (nullable)
  -- issuance rate limit: max 3 per phone per 15 min (Upstash)

clients                      -- the client entity (person/company the firm serves)
  id, firmId, name, phone, email (nullable), whatsappOptIn (bool default true), notes
  dataConsentAt (nullable — DPDP consent recorded at first portal login)

projects
  id, firmId, name, siteAddress, city, description
  clientId (FK → clients)
  status: active|on_hold|completed|archived

project_assignments
  id, projectId, userId (associate), assignedBy, UNIQUE(projectId, userId)

checklist_library_items
  id, firmId, title, titleHi (nullable), description, category
  helpText (nullable — plain-language "what is this / where do you get it"; shown to client)
  sampleImageKey (nullable), isActive

checklist_templates
  id, firmId, name, description, isActive
checklist_template_items
  id, templateId, libraryItemId, isMandatory, sortOrder

checklists
  id, firmId, projectId, title, notes
  status: draft|sent|in_progress|completed
  createdBy, sentAt, completedAt
  reminderCadenceDays (int default 3; 0 = off), lastReminderAt (nullable)

checklist_items              -- snapshot-copied from library/template or ad-hoc
  id, checklistId, libraryItemId (nullable), title, titleHi, description, helpText
  isMandatory (bool default true), sortOrder
  status: pending|uploaded|received|rejected|waived
  waivedReason (nullable), hardCopyReceived (bool default false),
  hardCopyNotedBy/At (nullable), reviewedBy/At (nullable), rejectionReason (nullable)

documents                    -- MULTIPLE ACTIVE docs per item allowed (e.g. 3 receipts)
  id, firmId, checklistItemId, uploadedBy (any role with access — client OR associate on-behalf)
  fileName (sanitized), fileSizeBytes, mimeType
  storageKey ({firmId}/{projectId}/{checklistId}/{itemId}/{uuid}-{sanitizedFileName})
  version (int), status: active|superseded
  deletedAt (nullable — soft delete / trash; purged by cron after 30 days, §10.1)

item_comments                -- two-way thread per item (replaces WhatsApp back-and-forth)
  id, checklistItemId, authorUserId, body (plain text, escaped on render), createdAt

notifications_log            -- every outbound WhatsApp/SMS/email
  id, firmId, recipientUserId, channel: whatsapp|sms|email
  templateKey, status: queued|sent|delivered|failed, providerMessageId, createdAt

activity_log
  id, firmId, actorUserId, action, entityType, entityId, metadata (jsonb), ipAddress, createdAt
  -- login, otp_login, support_view_as, user_created, project_created, checklist_sent,
  -- document_uploaded (metadata.onBehalf=true when associate uploads), document_downloaded,
  -- document_deleted, document_restored, item_received, item_rejected, item_waived,
  -- hard_copy_marked, comment_added, reminder_sent, plan_changed, data_exported,
  -- client_data_deleted, firm_export

plan_limits (seeded)
  tier, maxAssociates, maxActiveProjects, maxStorageBytes, maxClients, maxFileSizeBytes,
  whatsappQuotaPerMonth
```

**Seeded plan limits (INR/month, GST extra):**

| Tier | Price | Associates | Active projects | Storage | Clients | Max file | WhatsApp msgs/mo |
|---|---|---|---|---|---|---|---|
| silver | ₹1,499 | 3 | 10 | 5 GB | 25 | 25 MB | 200 |
| gold | ₹3,999 | 10 | 50 | 25 GB | 100 | 25 MB | 1,000 |
| platinum | ₹7,999 | unlimited (−1) | unlimited | 100 GB | unlimited | 50 MB | 5,000 |

*(Unit economics check: Meta utility-template WhatsApp ≈ ₹0.12–0.35/msg + MSG91 fees. Platinum worst case ≈ ₹1,750/mo message cost against ₹7,999 — acceptable. Quotas exist to cap abuse, not to nickel-and-dime.)*

**State machines (enforce in service layer, not UI only):**
- `checklist_items.status`: `pending → uploaded → received`; `uploaded → rejected → uploaded` (re-upload); `pending|uploaded|rejected → waived` (associate/admin only, reason required); `waived → pending` (un-waive). Upload (by client OR associate on-behalf) sets `uploaded`.
- **Checklist completion rule:** auto-complete when every mandatory item is `received` OR `waived`.
- `checklists.status`: `draft → sent` (notifications fire) `→ in_progress` (first upload) `→ completed`. Reminders run only in `sent|in_progress`.
- Documents: multiple `active` docs per item allowed. On **Reject**, all currently-active docs for that item → `superseded`; subsequent uploads are the new active set. Files never overwritten in storage (unique keys, immutable) — deletion only via trash-purge cron.

---

## 5. Application Structure

```
src/
  env.ts
  db/ schema.ts, index.ts, seed.ts
  i18n/ en.json, hi.json
  lib/
    auth.ts                   -- Auth.js: credentials (staff) + otp (client) providers
    authz.ts                  -- requireRole(), requireProjectAccess(), requireFirm(), rejectIfSupportReadOnly()
    storage.ts                -- backend-agnostic: presignUpload/presignDownload/deleteObject/headObject
                              --   drivers: r2.ts, s3-india.ts (STORAGE_BACKEND / per-firm override)
    notify.ts                 -- sendToClient(): WhatsApp → SMS → email fallback; staff: email
                              --   every send → notifications_log; template keys, not raw strings
    otp.ts, email.ts
    ratelimit.ts              -- Upstash-backed; in-memory driver for dev/test
    limits.ts                 -- checkLimit(firmId, 'associates'|'projects'|'storage'|'clients'|'whatsapp')
    activity.ts, dates.ts (IST render), pdf.ts (images→PDF merge, download watermark)
    sanitize.ts               -- fileName sanitization (strip path chars, control chars, cap length)
  services/                   -- ALL business logic; handlers/actions stay thin
    users, projects, library, templates, checklists, documents, comments,
    reminders, dashboard, billing, dpdp, support (view-as)   [*.service.ts]
  app/
    (marketing)/              -- landing, INR pricing, privacy, terms, refund-policy  ← refund page
                              --   REQUIRED for Razorpay live activation (§9.5)
    (auth)/login              -- staff email+password | client phone+OTP tabs; multi-firm account picker
    (auth)/accept-invite/[token], forgot-password
    (platform)/platform/…     -- firms, plans, metrics, view-as-firm (read-only)
    (firm)/dashboard, projects, projects/[id], projects/[id]/checklists/[checklistId]
    (firm)/library, templates, staff, clients, trash
    (firm)/settings/billing   -- plan, usage meters, GSTIN, invoice PDFs
    (firm)/settings/dpdp      -- firm export, per-client export/delete
    (client)/portal, portal/checklists/[id]
    api/
      health                                   -- uptime probe: DB ping + storage HeadBucket
      auth/otp/send, auth/otp/verify
      upload/presign, upload/complete
      download/[documentId]
      webhooks/razorpay, webhooks/msg91        -- delivery status → notifications_log
      cron/reminders                           -- 04:30 UTC daily (=10:00 IST), CRON_SECRET
      cron/purge                               -- trash purge (30d) + orphan cleanup (24h)
middleware.ts                 -- route-group protection by role
```

### 5.1 Client OTP login with multi-firm phones
Phone is NOT globally unique — the same person can be a client of two different firms. Flow:
1. Enter phone → OTP sent (rate-limited).
2. Verify OTP → look up all `active` client users with that phone.
3. Exactly one → session issued. Multiple → account picker ("Continue as client of {Firm A} / {Firm B}") → session for chosen account. Zero → "No account found; ask your architect to add you." (No self-signup for clients.)
4. First successful login for a client records `clients.dataConsentAt` after consent notice (EN/HI).

### 5.2 Upload flow (mobile-first; applies to client AND associate on-behalf uploads)
1. Tap item → chooser: **"Take photo(s)"** or **"Choose file"**.
2. Camera path: capture 1–N photos (cap 20/batch) → client-side compress (target ≤ 500 KB/page, max dim 2200 px) → preview strip (reorder/retake/delete) → upload as images; server merges to single PDF via `pdf.ts` (source images deleted after merge).
3. File path: client-side size/type validation first (friendly EN/HI error).
4. `POST /api/upload/presign` `{checklistItemId, fileName, fileSizeBytes, mimeType}` → server validates: authz (client owns item OR staff has project access), size ≤ plan max, storage quota, mime allowlist (`pdf jpg jpeg png webp dwg zip`), checklist status `sent|in_progress` (staff may also upload in `draft`). fileName sanitized.
5. Presigned PUT (10-min expiry) **with Content-Length signed into the URL** — a mismatched-size upload fails at the storage layer, closing the "presign small, PUT huge" quota hole. Browser PUTs directly to storage. Per-file progress; failed files retryable individually (no all-or-nothing batches).
6. `POST /api/upload/complete` → HeadObject verify (exists + size match) → create `documents` row, item → `uploaded`, `storageUsedBytes` incremented atomically, activity logged (`onBehalf` flagged for staff uploads), assigned associates notified (skip notify when uploader is staff).
7. Zip files: accepted for CAD bundles but **never extracted server-side** (zip-bomb safety); download-only.
8. Orphan cleanup: `cron/purge` deletes storage objects > 24 h old with no `documents` row.

### 5.3 Reminder engine (`cron/reminders`, 04:30 UTC = 10:00 IST daily)
- Checklists in `sent|in_progress` with `reminderCadenceDays > 0` and `lastReminderAt` stale: collect pending+rejected mandatory items → ONE consolidated WhatsApp/SMS ("3 documents pending for *Green Valley Bungalow*: Sale Deed, NA Order, PAN. Upload: {link}") → update `lastReminderAt`, log.
- WhatsApp quota exceeded → SMS fallback → email; channel downgrade logged, never silent.
- Associate weekly digest email: checklists with no client activity ≥ 7 days.
- Suspended/expired firms: reminders do not fire.

---

## 6. Build Phases

Execute in order. Each phase ends with acceptance criteria passing and a git commit. Do not start a phase before the prior one's criteria pass.

### Phase 0 — Scaffold (½ day)
- `create-next-app` (TS, App Router, Tailwind), shadcn/ui, Drizzle, Auth.js, Zod, next-intl, Sentry SDK, Vitest, Playwright.
- `src/env.ts` Zod-validated; `.env.example` committed. `api/health` endpoint.
- Scripts: `dev build test test:e2e db:generate db:migrate db:seed`.
- **Off-code action, start NOW (longest lead time in project):** DLT entity/header/template registration + WhatsApp template approval via MSG91 (§9.4); Razorpay KYC.
- **Accept:** app boots, `npm run build` clean, lint passes, health endpoint 200.

### Phase 1 — Schema + Dual Auth (2–3 days)
- Full Drizzle schema (§4) incl. constraints (staff global-unique email; client UNIQUE(firmId, phone)); migration; seed (plan limits + demo firm: 1 admin, 2 associates, 2 clients with Indian names/phones — one client phone also seeded in a second demo firm to exercise the account picker).
- Staff auth; client OTP auth per §5.1 (MSG91 mock driver in dev/test — code logged to console); consent capture; OTP rate limits via `ratelimit.ts`.
- Middleware route-group protection; invite flow (staff, 24 h single-use token); forgot-password (staff only).
- **Accept:** all four roles log in; multi-firm phone hits account picker (e2e); cross-role URLs blocked; invite + reset e2e green; OTP rate-limit unit tests green.

### Phase 2 — Firm Admin Core (2–3 days)
- **Staff:** list/create/disable associates (enforce `maxAssociates`; at-limit → upgrade prompt).
- **Clients:** CRUD (phone mandatory, email optional, WhatsApp opt-in) + "create login" + "add co-owner login" (second user, same clientId) + welcome WhatsApp/SMS with portal link.
- **Projects:** CRUD, assign client, allocate/deallocate associates.
- **Library:** CRUD with categories, helpText, optional Hindi title, optional sample image, `isActive` soft-delete. **Templates:** CRUD composed from library items.
- Seed library ~30 real Indian liaison document types with helpText: Land Records (Sale Deed, 7/12 Extract / RTC, Property Card, Mutation / Ferfar, Index II), Approvals (NA Order, Zone/ULC Certificate, Sanctioned Plan, Commencement Certificate, Occupancy Certificate, RERA Certificate), Identity (PAN, Aadhaar — helpText: *masked Aadhaar acceptable & preferred*, §9.11), NOCs (Fire, Environment, Aviation/AAI, Society), Utilities (Water, Electricity sanction), Legal (Power of Attorney, Development Agreement, Title Search Report). Seed 2 templates.
- **Accept:** associate sees only allocated projects; silver firm's 4th associate rejected (unit test); template → checklist composition works; co-owner login reaches same project.

### Phase 3 — Checklists + Review (2–3 days)
- Create checklist from template (one click, then edit) or library picker (search + category + multi-select); ad-hoc items; mandatory flags; drag-reorder.
- **Send** → snapshot items, notify client (WhatsApp-first), default cadence 3 days (editable).
- Review UI: all active docs per item (multiple allowed), download, **Mark Received / Reject** (reason required → client notified) / **Waive** (reason required) / un-waive, **Hard Copy Received** toggle.
- **Associate on-behalf upload** from the review screen (same §5.2 flow, `onBehalf` logged, no self-notification).
- **Item comments** thread, associate ↔ client, cross-notification; bodies rendered as escaped plain text (XSS-safe).
- Document soft-delete to firm **Trash** (restore within 30 days).
- Auto-complete when all mandatory items `received|waived`.
- **Accept:** state machine incl. waive/un-waive unit-tested; e2e: template → send → upload → reject → re-upload → receive → waive last item → auto-complete; on-behalf upload sets `uploaded` and logs `onBehalf`; trash restore works.

### Phase 4 — Client Portal (3–4 days) ← highest-stakes phase, mobile-first
- Locale switcher EN/हिन्दी (persisted); all portal strings via next-intl — zero hardcoded English in `(client)/`.
- Home: project cards → checklists with status chips; big touch targets; 360 px-wide layouts.
- Checklist page: per-item status, expandable helpText + sample image, rejection reason + comment thread inline, waived items shown as "not required" (with note).
- Upload per §5.2: camera multi-capture → compress → preview → merge-to-PDF; file-picker path; per-file progress + individual retry; partial progress is the norm (2 docs today, 3 later — no "submit all" gate).
- Friendly bilingual errors ("File is 32 MB; limit is 25 MB. Tip: use Take Photo — it compresses automatically").
- Download endpoint: authz → activity log → 5-min presigned GET redirect.
- **Accept:** Playwright mobile-viewport e2e — OTP login → account picker → upload 2 of 5 via mock camera files → associate rejects one → client sees reason in Hindi → re-upload → received → complete. Direct storage URL without presign fails. Lighthouse mobile ≥ 85 on portal pages.

### Phase 5 — Reminders, Dashboards + Search (2 days)
- Reminder cron per §5.3 (consolidated, quota-aware fallback, logged); weekly associate digest.
- **Firm dashboard:** cards (active projects, pending items, docs awaiting review, storage vs quota); project table (client, associates, open checklists, progress %, last activity, days-since-client-activity red ≥ 7); admin extra: per-associate workload. Associate scope enforced.
- Simple global search (projects + clients by name/phone) in firm header.
- Client dashboard; per-project activity feed; firm-wide feed (admin).
- Platform dashboard: firms, tiers, storage, WhatsApp usage, MRR; **read-only view-as-firm** (banner, logged, mutations rejected by `rejectIfSupportReadOnly`).
- **Accept:** reminder cron integration test with injected clock (no `Date.now()` in services); dashboard numbers reconcile with DB; associate dashboard excludes non-allocated (authz test); view-as-firm mutation attempt fails + is logged.

### Phase 6 — Billing, GST, Lifecycle + Marketing (2–3 days)
- Razorpay Subscriptions checkout (UPI Autopay/cards/netbanking); webhooks (`subscription.activated|charged|halted|cancelled`) update plan state; signature verification mandatory (invalid → 400 + Sentry).
- **GST invoices:** platform GSTIN + firm GSTIN, SAC 998314, CGST+SGST (intra-state) vs IGST (inter-state), INR; PDF via `pdf.ts`, downloadable from billing page.
- **Firm lifecycle (§9.10):** 14-day card-less trial (gold limits) → expiry unpaid: read-only 14 days → suspended 60 days (clients can still *download* their own docs; nothing else) → warning emails at each transition → hard delete after `deleteAfter`. `past_due`: 30-day grace read-only. All transitions via daily cron, all reversible until final purge, banner at every stage.
- Usage meters incl. WhatsApp quota.
- **Marketing:** landing + INR pricing + firm signup (creates firm + admin, starts trial) + **privacy policy, terms, refund/cancellation policy** (Razorpay live-mode activation requires all three; content per §9.3/§9.5 — real content, not lorem ipsum).
- **Accept:** invalid webhook signature rejected; tier change immediately affects limits (mocked webhooks); GST invoice correct for same-state and inter-state; lifecycle transitions unit-tested with injected clock.

### Phase 7 — Security, DPDP + Hardening (2 days)
- **Authz matrix suite (highest priority):** every service method × role × in-firm/other-firm × allocated/not. Cross-tenant → **404, never 403**.
- Rate limits (Upstash): login 5/min/IP, OTP per §5.1, presign 30/min/user, download 60/min/user.
- Sessions: staff JWT 8 h; client JWT 30 days (phone possession is the factor; long session cuts OTP cost/friction) + prominent logout for shared phones.
- Staff password policy: min 10 chars, top-10k blocklist.
- Security headers (CSP, X-Frame-Options DENY, nosniff), strict CORS, bucket CORS locked to app origin.
- **DPDP tooling:** per-client export (zip: docs + JSON records) and hard-delete (docs purged, rows anonymized, activity_log kept with anonymized actor); **firm-level export** (all records JSON + document manifest with 24 h presigned links). All logged.
- PDF download watermark: "Downloaded by {name} on {date IST} via {firm}" (pdf mimes).
- `cron/purge`: trash purge (30 d, decrements storage) + orphan cleanup (24 h). Cron endpoints require `CRON_SECRET`.
- **Accept:** authz matrix green; `npm audit` no criticals; export/delete/firm-export e2e; watermark verified in test; trash purge decrements `storageUsedBytes` correctly.

### Phase 8 — Ops, Polish + Deploy (1–2 days)
- Sentry wired (client + server, source maps); uptime monitor on `/api/health`; §10 runbook written into `README-OPS.md` (backup/restore drill, breach notification steps, R2 second-bucket sync).
- Onboarding: new firm's empty dashboard shows guided setup checklist (add associate → add client → create project → send first checklist).
- Empty states, skeletons, toasts, optimistic checklist marking.
- Portal QA on real low-end Android or emulated 360×740 + throttled 3G: camera flow, retry flow, account picker.
- Deploy: Vercel (`bom1`), Supabase Mumbai Pro (PITR on), R2 (private, `apac`, CORS locked), MSG91 prod templates (DLT approved), Resend domain, Razorpay live (needs policy pages live), Vercel crons (04:30 UTC reminders; purge; lifecycle).
- Production smoke: seed firm, one real OTP, one real WhatsApp send, one upload/download round-trip, verify Sentry event + `notifications_log` rows.
- **Accept:** production URL, full journey live, reminder cron verified in prod, restore drill from backup performed once and documented.

**Total estimate: ~18–25 working days.**

---

## 7. Key Implementation Rules (agent must follow)

1. **Tenant isolation non-negotiable.** All DB access through service functions applying `firmId` + role scope via `authz.ts`. No raw queries in components/route handlers.
2. **Files never transit the app server** (sole exception: image→PDF merge reads from storage, writes merged PDF, deletes sources). Bucket private; no public ACLs. Storage keys immutable — never overwrite an object.
3. **Cross-tenant requests return 404**, never 403.
4. **Snapshot, don't reference:** checklist items copy title/titleHi/description/helpText at creation; later library edits must not mutate sent checklists.
5. **Server-side validation authoritative**; Zod schemas shared between form and API. fileName through `sanitize.ts`; comment bodies escaped on render.
6. **Every state-changing action → `activity_log`; every outbound message → `notifications_log`.**
7. **Notifications fire-and-forget** (never block mutations on provider failures; log + Sentry). All client-facing sends via `notify.ts` fallback chain — never call providers directly from services.
8. **Storage accounting atomic:** SQL `+=`/`-=` only; increment on upload-complete, decrement on trash purge; quota checked at presign; Content-Length signed into presigned PUT.
9. **Mime + extension allowlist:** `pdf jpg jpeg png webp dwg zip`; zips never extracted server-side.
10. **No secrets in client bundles**; verify in `next build` output.
11. **No `Date.now()` in services** — inject clock; all display through `dates.ts` (IST). Crons scheduled in UTC.
12. **All client-portal strings through i18n files.**
13. **Mock drivers for MSG91/Razorpay/storage/ratelimit in tests** — suite runs offline.
14. **Support view-as is read-only** — enforced in the service layer, not just UI.

---

## 8. Out of Scope (v1 — do not build)

- In-browser document preview/annotation (download only; v2)
- OCR / auto-classification
- Languages beyond EN+HI (structure ready)
- Native mobile apps / PWA offline queue (v1 = per-file retry only)
- SSO/OAuth staff logins
- Aadhaar eSign / DSC signatures (v2 roadmap)
- Document expiry/validity tracking (NOC renewal dates — v2)
- Multiple client entities per project (v1: one client entity, multiple co-owner logins on it)
- Firm-to-firm sharing; Stripe; antivirus scanning (v2 known gap; mime allowlist partial mitigation)
- In-app notification bell (WhatsApp/SMS/email only in v1)

---

## 9. India-Specific Requirements (rationale — read before building)

### 9.1 Client auth = phone + OTP
Email is unreliable identity for Indian retail clients; phone is universal. Passwords for occasional-use portals get forgotten → support calls → associates revert to WhatsApp. Staff keep email+password. **Phone is not globally unique** — same person can be client of two firms; see §5.1 account picker.

### 9.2 WhatsApp-first notifications
WhatsApp is the default business channel in India. Every client-facing event (checklist sent, rejection, reminder, comment) goes WhatsApp → SMS → email fallback. The auto-reminder engine is the product's strongest selling point vs. "associate manually WhatsApps the client".

### 9.3 DPDP Act 2023 — correct role split
- For **client documents/data**: the **firm is the Data Fiduciary** (it decides purpose); the **platform is a Data Processor** acting on the firm's instructions. Terms of service must include data-processing terms (a DPA section) between platform and firm.
- For **firm-account data** (staff names, billing): the **platform is the Fiduciary**.
- v1 obligations: consent capture at client first login (plain-language EN/HI); per-client export + erasure (firm-admin triggered — the firm services data-principal requests, platform provides the tooling); grievance contact (firm's `grievanceEmail` + platform contact on privacy page); breach-notification runbook in `README-OPS.md`; audit trail via activity/notification logs.
- Residency: DPDP does not currently mandate localization, but enterprise firms ask — hence Supabase Mumbai + storage-backend abstraction (S3 ap-south-1 driver).

### 9.4 DLT registration (SMS) — start at Phase 0
Indian SMS requires DLT registration: entity, header (sender ID), per-template approval, **before any SMS sends**. Lead time days–weeks. WhatsApp Business templates need Meta approval via MSG91. Mock drivers keep the build unblocked; registration runs in parallel from day one.

### 9.5 GST + Razorpay activation
18% GST, SAC 998314; invoices carry both GSTINs, place of supply, CGST+SGST vs IGST. Firms need input tax credit — no proper invoice → churn. **Razorpay live-mode activation requires published privacy, terms, AND refund/cancellation policy pages** — they are launch blockers, not filler.

### 9.6 Network & device reality
Uploads happen on mid/low-end Androids over patchy 4G. Hence: client-side compression (12 MP photo 4–6 MB → ≤ 500 KB), per-file progress with individual retry, no all-or-nothing batches, Lighthouse mobile ≥ 85, 360 px layouts.

### 9.7 Hard-copy + no-smartphone reality
Liaison work needs physical originals — `hardCopyReceived` tracks them (else firms keep a parallel paper register). Some clients never use the portal — the **associate on-behalf upload** path keeps those projects in the system instead of back in Excel.

### 9.8 Language
Firm side English. Client portal EN + HI at launch; per-item `titleHi` + translated strings. next-intl structure makes further languages file-drops.

### 9.9 Timezone
Store UTC, render IST everywhere (`dates.ts`). Vercel crons are UTC — reminder cron at 04:30 UTC = 10:00 IST.

### 9.10 Firm lifecycle (trial → paid → lapsed)
Explicit, reversible-until-purged: `trialing` (14 d, card-less, gold limits) → unpaid: **read-only** 14 d → **suspended** 60 d (clients may still download their own documents; nothing else works) → **hard delete** after warning emails at every transition. `past_due` (failed renewal): 30 d read-only grace. Prevents both silent data loss and unbounded free storage.

### 9.11 Aadhaar handling
Firms collect Aadhaar copies. Per UIDAI guidance, prefer **masked Aadhaar** (last 4 digits). The seeded Aadhaar library item's helpText tells clients masked copies are acceptable and how to download one from the UIDAI site. Platform does not parse or index Aadhaar numbers.

---

## 10. Operations (backup, monitoring, support)

### 10.1 Backup & disaster recovery
- **Database:** Supabase Pro — PITR enabled; daily automated backups. Target RPO ≤ 24 h (PITR gives minutes), RTO ≤ 4 h.
- **Files:** R2 has no object versioning — the design compensates: storage keys are **immutable** (never overwritten), deletion happens ONLY via `cron/purge` after a 30-day trash window, so associate/client mistakes are recoverable for 30 days by design. Additionally: weekly `rclone sync` R2 → second R2 bucket (different account/API keys) documented in `README-OPS.md` — protects against account compromise and fat-fingered bucket operations.
- **Restore drill:** performed once before launch (Phase 8 acceptance) and documented step-by-step.

### 10.2 Monitoring
- **Sentry**: client + server errors, source maps, alert on new issue.
- **`/api/health`**: DB ping + storage HeadBucket; external uptime monitor (1-min interval) alerting to founder phone.
- **Silent-failure watch:** daily cron summary email to platform owner — OTP failure rate, notification failure rate (from `notifications_log`), webhook errors. An OTP outage locks every client out; it must page someone.

### 10.3 Support
- Platform owner **read-only view-as-firm** (banner, fully logged, mutations blocked in service layer) — debugs firm complaints without password sharing.
- Firm-facing support channel v1 = WhatsApp/email to platform owner; in-app ticketing is v2.
