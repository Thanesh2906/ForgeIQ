# Deploying ForgeIQ

## Supabase

1. Create a dedicated project in an appropriate region.
2. Apply the entire initial migration before allowing signups. It creates tables, indexes, signup triggers, financial functions, private `documents`/`reports` buckets and access policies.
3. Set Auth Site URL to the canonical HTTPS app URL. Allow its `/auth/callback` and password-reset callback. Enable email confirmation, password protections and production SMTP. Consider Supabase's CAPTCHA and signup protections before a public rollout.
4. Never make storage buckets public. No authenticated direct-write policies are necessary: the app issues signed upload URLs after checking identity, consent and quotas. The documents bucket caps individual files at 10 MiB. The app can reduce, but cannot increase, that limit via `MAX_FILE_BYTES`.
5. Check two separate accounts for isolation using the staging procedure. Service-role credentials belong only in server environment variables.

## Vercel

1. Import `Thanesh2906/ForgeIQ`, choose Next.js, root directory `/`, Node 22, build command `npm run build`.
2. Set environment variables from `.env.example` for the correct environment. `APP_URL` must be the exact origin users will use, without a trailing path. Authenticated write requests from any other origin are rejected.
3. Set `INNGEST_DEV=0` and configure Inngest event/signing keys. Keep payments off until test webhooks are configured.
4. Deploy and inspect build logs. No long-running local worker is required. `/api/inngest` allows a 300-second request; each file is processed in a separate durable step, and the OpenAI request is timeout-bounded. Ensure the selected Vercel plan supports the function duration.
5. Connect the deployed `/api/inngest` endpoint to Inngest Cloud, sync the functions, and check that `analyze-job` is registered. The event name is `forgeiq/analysis.requested`.
6. `vercel.json` schedules `/api/cron/dispatch` every minute and `/api/cron/retention` daily at 03:00 UTC. Vercel attaches `Authorization: Bearer CRON_SECRET`. **Minute cron requires a suitable paid Vercel plan.** On a plan without that schedule, remove Vercel crons and configure an external scheduler to call both endpoints with this header. Do not simply omit dispatch/retention scheduling.
7. Verify pending-outbox recovery by temporarily interrupting Inngest event delivery, then restore it. Jobs that repeatedly cannot dispatch or remain stale are failed and refunded. Monitor outbox age and failures. Retention uses bounded batches (200 files/reports per invocation); if `moreMayRemain` is true, invoke again or increase the authenticated schedule frequency.
8. Complete every staging gate in `TESTING.md` before accepting customer documents.

## Domain plan

Initially use one canonical origin, e.g. `https://forgeiq.example`, with `/dashboard`, `/dashboard/new/quotation`, and `/dashboard/new/ecommerce`.

To use a marketing domain plus `app.<domain>`, choose the app subdomain as `APP_URL` and configure marketing links/redirects to point to that canonical app origin. Do not enable writes on several origins without an explicit allowlist and Auth callback review. This delivery does not assume ownership of any ForgeIQ domain or configure DNS.

The modules are identified by a database key and route, so later service subdomains can share the wallet and authentication. Cross-subdomain sessions, organizations and separate deployments require deliberate additional configuration, not broad cookie-domain defaults.

## Operational launch requirements

- Configure real service credentials, billing caps and failure alerts; verify provider connectivity.
- Verify the database backup/restore process, retention processing and interrupted deletion recovery.
- Monitor failed jobs, unknown cost rates, failed webhooks, refund shortfalls and queue lag.
- Review region choices, subprocessors, contractual terms and draft legal notices with qualified advisers.
- Measure actual model usage, retries, storage, bandwidth, queue and hosting costs before setting commercial credit prices.
- Complete dependency/security review and staging UI/accessibility testing.
- Keep live payments disabled until the legal entity, merchant account and refund/subscription policies have been implemented and reviewed.
