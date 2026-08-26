# BTG Billing — Business Travels Group

Self-hosted invoicing & cash-flow management system. Built as a Next.js
modular monolith with PostgreSQL + Prisma, deployed via Docker Compose
behind Caddy at `billing.businesstravelsgroup.in`.

See `btg-billing-architecture-v1.md` (shared earlier in this conversation)
for the full architecture rationale, ERD, and roadmap this implements.

## What's implemented (V1)

- Auth: email/password login, 3 roles (Admin / Finance / Sales), session-based, RBAC on every API route
- Customers: CRUD with GSTIN/state capture
- Invoices: line items, automatic CGST/SGST vs IGST split based on customer state, sequential invoice numbering per financial year, PDF generation (Puppeteer), status lifecycle
- Payments: recorded per customer, split/partial allocation across multiple invoices in one DB transaction, hard `CHECK`-equivalent guard against over-allocation
- Expenses: categorized, tracked as cash outflow
- Dashboard: total invoiced, received, outstanding, overdue, expenses, net cash flow, overdue list, upcoming payments
- Reminders: configurable before/on/after-due rules, hourly cron worker, DB-level unique constraint preventing duplicate sends
- Audit log: every create/update/void/payment write is logged with actor, entity, and diff
- Backups: nightly `pg_dump`, local retention + a stub for offsite copy

## Prerequisites

- A server (VPS is fine) with Docker + Docker Compose installed
- DNS: an A record for `billing.businesstravelsgroup.in` pointing at that server's IP
- An SMTP relay for reminder emails (AWS SES, Postmark, Zoho Mail, etc.) — do **not** try to self-host mail, deliverability will suffer
- Ports 80 and 443 open on the server

## First-time setup

```bash
git clone <this-repo> btg-billing
cd btg-billing
cp .env.example .env
```

Edit `.env` and fill in:
- `POSTGRES_PASSWORD` — strong random password
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- `SEED_ADMIN_PASSWORD` — the first admin login password (change it after first login)
- `SMTP_*` — your transactional email provider's credentials

```bash
docker compose up -d --build
```

This starts Postgres, runs migrations automatically (`app` container's start
command), then boots the app, the reminder worker, Caddy (which will fetch
a Let's Encrypt certificate automatically for `billing.businesstravelsgroup.in`),
and the nightly backup sidecar.

Seed the database (creates the admin user, default settings, expense
categories, and the 5 standard reminder rules):

```bash
docker compose exec app npx tsx prisma/seed.ts
```

Log in at `https://billing.businesstravelsgroup.in` with
`admin@businesstravelsgroup.in` and the password you set in
`SEED_ADMIN_PASSWORD` — then change it immediately (a password-change
screen isn't wired into the UI yet in V1; simplest path for now is updating
`passwordHash` via a short one-off script, or add a `/settings/account`
page as a fast follow).

Before creating your first invoice, set your company details so PDFs and
the GST split calculate correctly:

```bash
docker compose exec db psql -U btg_admin -d btg_billing -c "
UPDATE settings SET value = 'Business Travels Group Pvt Ltd' WHERE key = 'company.name';
UPDATE settings SET value = 'YOUR_GSTIN_HERE' WHERE key = 'company.gstin';
UPDATE settings SET value = 'Your registered office address' WHERE key = 'company.address';
UPDATE settings SET value = 'YOUR_STATE_CODE' WHERE key = 'company.state_code';
"
```
(State codes are the standard 2-digit GST state codes, e.g. `07` = Delhi, `27` = Maharashtra.)

## Day-to-day operation

- **New customer** → Customers → Add customer
- **New invoice** → Invoices → New invoice → add line items with HSN/SAC + GST rate → the CGST/SGST vs IGST split is computed automatically from the customer's state vs your `company.state_code` setting
- **Record a payment** → Payments → Record payment → pick the customer, enter the amount received, then allocate it across one or more of their outstanding invoices (use "Auto-allocate" to apply oldest-first)
- **Log an expense** → Expenses → Add expense
- **Reminders** run automatically every hour via the `worker` container — no manual step needed once the 5 seeded rules are active. Check `reminder_logs` in the DB if you need to confirm a specific send.

## Backups & restore

Nightly backups run automatically inside the `backup` container and land in
the `backups` Docker volume as `btg_billing_<timestamp>.sql.gz`, retained
for `BACKUP_RETENTION_DAYS` (default 30).

**This is currently your only copy.** Until you configure the offsite copy
step (S3 / Backblaze B2 / another host) in `deploy/backup.sh`, periodically
run this from the server to pull a copy off-box:

```bash
docker compose cp backup:/backups ./local-backup-copy
```

**To restore** (e.g. disaster recovery, or rolling back a bad data change):

```bash
./deploy/restore.sh /path/to/btg_billing_20260101_020000.sql.gz
```

This stops the app, drops and recreates the database, restores from the
dump, then restarts the app. Test this at least once against a scratch copy
before you actually need it.

## Extending this V1

Straightforward next additions, roughly in priority order:
1. Account settings page (password change, company details UI instead of raw SQL)
2. Attachments upload UI (the `attachments` table and API plumbing exist; no upload widget yet)
3. CSV/PDF export for reports
4. Reminder rule management UI (the table + cron logic exist; currently edited via API/DB directly)
5. Multi-entity support in `settings` if you ever bill under more than one legal entity

## Project structure

```
prisma/schema.prisma       Full ERD (users, customers, invoices, invoice_items,
                            payments, payment_allocations, expenses,
                            expense_categories, reminders, reminder_logs,
                            audit_logs, attachments, settings)
src/lib/                   gst.ts (tax engine), pdf.ts (Puppeteer renderer),
                            email.ts, auth.ts, permissions.ts (RBAC), audit.ts
src/app/api/v1/            REST endpoints
src/app/(dashboard)/       UI pages (auth-guarded via layout.tsx)
src/workers/reminder-cron.ts   Standalone cron process (see `worker` service)
deploy/                    Caddyfile, backup.sh, restore.sh
docker-compose.yml          app + worker + db + caddy + backup
```
