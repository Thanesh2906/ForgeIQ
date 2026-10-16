# ForgeIQ

A Next.js AI business-intelligence MVP for supplier quotation comparisons and e-commerce evidence analysis. This repository contains the application, PostgreSQL migrations, durable job orchestration, test payment integration, automated tests and deployment instructions.

**Status:** implemented for integration and staging validation. No cloud resources or credentials are bundled. A successful local build does not mean the system has been deployed or tested against your live provider accounts. Production payments are deliberately unsupported.

## What is included

- Responsive marketing site and protected workspace, light/dark mode, accessible Radix mobile navigation.
- Supabase email/password authentication, email confirmation, reset flow and server-verified sessions.
- Private direct-to-storage uploads, progress, file-content validation, safe bounded Office/CSV parsing, signed downloads and deletion.
- Quotation extraction: suppliers, products, specifications, quantities, currencies, prices, delivery, tax/fee terms and warranty; source-linked side-by-side comparison.
- E-commerce extraction: complaints, defect categories, sentiment, review/return records and source-backed recommendations.
- Structured OpenAI responses validated with Zod. Unsupported facts remain null. No exchange-rate conversion or inferred revenue/loss totals.
- Durable Inngest steps, database outbox, dispatch retries, failure refunds and a stalled-job safety sweep.
- Atomic shared wallet, append-only application ledger, idempotent deductions, refunds and administrator adjustments.
- PDF and Excel exports with evidence, interpretation, calculation and limitation labels.
- Stripe **test-only** checkout through a provider interface; verified webhook settlement, duplicate-event protection and refund records.
- Admin directory, module/pricing controls, account allowances, packages, API-token/cost estimates, processing monitor and audit trail.
- Draft legal pages, processing consent, retention controls and resumable account deletion.
- RLS on all application tables. Privileged database functions are service-role-only.

## Local setup

Use Node.js **22 LTS** (Node 24 is also accepted).

```bash
npm ci
cp .env.example .env.local
```

1. Create a Supabase project and run **all** of `supabase/migrations/202610160001_initial.sql` in its SQL editor, or apply it through the Supabase CLI migration workflow. Use a new project/schema. The migration includes broad public-schema privilege tightening appropriate to this dedicated app.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`.
3. Set `APP_URL=http://localhost:3000`. In Supabase Auth set the Site URL accordingly and allow `http://localhost:3000/auth/callback` plus `http://localhost:3000/auth/callback?next=/auth/reset`. Enable email confirmation, set a minimum 12-character password, and configure production SMTP before public signup. Auth email links must preserve the PKCE code redirect flow.
4. Set `OPENAI_API_KEY`. `OPENAI_MODEL` defaults to `gpt-4.1-mini`; choose a model available to your account that supports image/PDF inputs and structured outputs. Leave cost-rate variables empty until you have verified current rates for that exact model. Empty rates mean **unknown**, not free.
5. For local jobs set `INNGEST_DEV=1`, start the app, then run the Inngest dev server in a second terminal:

```bash
npm run dev
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

6. Register, confirm your email, sign in, and review the processing consent in Settings before uploading. Default trial allowance is an editable example of 25 credits.
7. Set a random `CRON_SECRET` of at least 32 bytes for scheduled endpoints. Do not paste credentials into source control, logs, issues or chat.

The homepage builds without provider credentials. Protected functionality deliberately does not pretend to work when configuration is missing.

## Bootstrap an administrator

Create and confirm your own account, then run this once in the Supabase SQL editor, replacing the email:

```sql
update public.profiles set role = 'admin' where email = 'YOUR_CONFIRMED_EMAIL';
```

Open `/admin`. User-controlled signup metadata cannot grant administrator privileges. Financial writes always pass through server authorization and service-role database RPCs.

## Test payments

1. Keep real payments disabled. This code rejects secret keys that do not start with `sk_test_` and rejects live-mode webhook events.
2. Set `STRIPE_SECRET_KEY` to your Stripe test secret, `STRIPE_WEBHOOK_SECRET` to the endpoint signing secret, and `PAYMENTS_ENABLED=true` only to enable **test checkout**.
3. Forward local webhooks with Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Subscribe the deployed endpoint to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, and `charge.refunded`.

4. Choose a package in Billing and use Stripe's documented test payment details. Verify that returning to the app alone does not change the wallet; delivery of the signed paid event does.
5. Issue test refunds in Stripe. Credits are proportionally recovered up to the available wallet balance; any shortfall is recorded in `payment_refunds` for operator review. The wallet never becomes negative. This is a **test-mode policy**, not a final commercial refund policy.

Example packages and rates are editable. Subscription allowances are stored configuration only; recurring billing and automatic monthly grants are not implemented.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Tests execute the migration and financial/RLS functions in PGlite (real PostgreSQL compiled to WASM), exercise parsers, report formats and Stripe signature boundaries. PGlite tests use an explicitly simulated Supabase auth/storage schema and do not replace testing in your Supabase project.

For true multi-connection locking validation against a **disposable**, migrated Supabase database:

```bash
TEST_DATABASE_URL='YOUR_DISPOSABLE_DATABASE_URL' ALLOW_DISPOSABLE_DB_TEST=yes npm run test:db
```

This creates and removes a test account and checks concurrent charge/refund idempotency. Never point it at production. Provider end-to-end checks are listed in [docs/TESTING.md](docs/TESTING.md).

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Vercel imports this repository directly. The application needs Supabase, OpenAI and Inngest accounts; Stripe is optional. The minute-level dispatch cron requires a Vercel plan that supports that frequency or an external authenticated scheduler.

## Architecture and boundaries

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATA_PROCESSING.md](docs/DATA_PROCESSING.md), and [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).

The MVP uses one application with modular service routes. Organization tables are provisioned, but records remain user-owned; team invitation/shared organization access and separate service subdomains are future work. No legal certification, live production deployment, visual browser verification or live provider test is claimed by this source delivery.
