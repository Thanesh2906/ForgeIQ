# Implementation status

## Implemented source

The public site, auth flow, protected dashboard, both analysis modules, private file pipeline, database/RLS, durable outbox/Inngest workflow, wallet and ledger, refunds, exports, admin controls, test billing, privacy settings and deletion controls are implemented in this repository. They depend on configured external services, not mock-only client results.

The landing page contains an explicitly labeled illustrative preview. Authenticated dashboards use database records; no example customer numbers are presented as real usage.

## External setup still required

- Provision Supabase and apply migrations; configure Auth redirects, email and credentials.
- Configure an OpenAI API key and model access, spending limits and verified cost rates.
- Configure Inngest credentials, function sync and authenticated dispatch/retention schedules.
- Import into Vercel, set the canonical origin/environment, deploy and verify.
- Optionally configure Stripe test credentials and webhook events.
- Bootstrap an administrator, complete staging checks and replace draft legal/operator details.

## Deliberately incomplete / future scope

- Production payment processing is hard-disabled; only Stripe test keys/events are accepted.
- Subscription allowances are editable stored configuration; recurring subscriptions and scheduled allowance grants are not implemented.
- Organizations/membership schema is present, but the MVP has personal user-owned workspaces, without invites or shared organization access.
- Separate service subdomains, custom domains, DNS and cross-domain login have not been provisioned. Both modules work as routes in the single app.
- No exchange-rate provider or currency conversion. No automatically asserted overall procurement savings, total revenue or aggregate financial loss.
- No external vendor integrations (Shopify/Amazon/Shopee/Lazada); the MVP analyzes uploaded evidence.
- No antivirus, enterprise DLP, custom residency enforcement, SOC 2 certification or legal-compliance claim.
- Administrators can view users, change other users’ access roles, adjust credits and configure the platform. The first admin is bootstrapped in trusted SQL. User suspension, organization management and support impersonation are not implemented.
- Results/usage histories are bounded to recent records; broad search, pagination and analytics warehouses are future work.
- Prompt instructions and schema validation reduce extraction risks but do not guarantee that model claims or citations match the source. Human verification is required.
- Provider API costs for attempts interrupted before persistence may be missing from estimates. Infrastructure costs and final commercial pricing require real measurement.
- Original file retention is capped at upload time; shortening retention takes effect on existing files. Increasing retention does not extend existing expiries. Derived reports use the current profile setting.
- Account deletion removes application payment/ledger records for this test MVP. Before paid production, define legally required accounting retention and provider deletion handling.
- Browser QA, real PostgreSQL multi-connection checks and provider end-to-end validation remain environment-dependent gates, not claimed completed work.
