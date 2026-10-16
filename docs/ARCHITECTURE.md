# Architecture

## Request and job flow

1. A server-verified Supabase session permits upload metadata reservation. The database upload guard locks the user's wallet row to serialize quota checks and prevent reservations once account deletion begins.
2. The browser uploads directly to a private Storage object using a signed upload URL, avoiding Vercel's request-body limit. Progress is displayed. User-supplied names never become object paths.
3. The completion route downloads the object, verifies byte size, extension/content compatibility and archive constraints, then marks it ready.
4. `begin_analysis` locks the wallet, checks consent, module availability, file ownership/state/expiry, job limits and current pricing, atomically reserves credits, attaches files, records the ledger and creates an outbox event. Repeated request UUIDs return the original job without another charge.
5. An immediate dispatcher and scheduled retry dispatcher send an event to Inngest. Events contain only the job ID. A lease handles dispatcher concurrency; stable event IDs and function idempotency suppress duplicate runs.
6. Each Inngest step handles one source file. Office/CSV text is parsed locally; PDFs and images use model-native input. Each extraction is validated and stored in Supabase. Step return values contain IDs/status only, not extracted document contents.
7. Deterministic aggregation computes limited comparable-price differences and input-record counts. It does not perform currency conversion, assert an overall cheapest supplier, or invent business totals. A terminal transaction stores the report once.
8. Exhausted failures call `fail_analysis`, which locks the job and refunds once. A completed job cannot later be refunded by a late failure callback; a failed job cannot later publish a result. A daily sweep refunds jobs stale for 24 hours. Inngest may still incur upstream costs if a request succeeds just before a worker interruption; exactly-once external API execution is not claimed.
9. Explicit user retry creates a new charged job after the previous job was refunded. All original files must remain ready and unexpired. Retried extraction is rerun; old partial extraction data is cleared.

## Security boundaries

- RLS is enabled on every public table. Users can select their own records, not mutate financial/job state directly.
- Role comes from the protected profile row, never request input or signup metadata. `/admin` and all admin mutations check it on the server.
- `SUPABASE_SERVICE_ROLE_KEY`, OpenAI, Inngest and Stripe secrets are used only in server code.
- Serverless-safe rate limits are stored in PostgreSQL. Supabase separately handles authentication limits; production signup protections must be configured there.
- Write APIs require the configured canonical origin. Signed downloads expire after 60 seconds. Signed upload links use Supabase's provider-defined lifetime and immutable object paths; they are not advertised as 60-second links.
- Source content is untrusted evidence. The model receives no executable tools. Content is not logged by this application. Prompts alone cannot guarantee perfect extraction; results explicitly require human source review.
- ZIP parsing streams members with actual expansion budgets before Office parsing, rejects encrypted/embedded/macro content, limits files to 10 MiB and decompressed archives to 30 MiB. Spreadsheets cap rows, columns and total cells; extracted text caps at 60,000 characters instead of silently truncating. This is format validation, not antivirus or DLP.
- Original-file deletion takes the same file-row lock used during job creation and enters a retryable `deleting` state before removing storage. Active jobs block deletion.
- Account deletion locks the wallet, blocks new job/upload reservations, removes objects in batches, then removes the auth user. Cascades erase user data. Minimal audit entries can remain with a null actor; the operator must finalize legal retention requirements.

## Core modules

| Path                  | Responsibility                                             |
| --------------------- | ---------------------------------------------------------- |
| `src/app`             | Public pages, authenticated pages, route handlers          |
| `src/components`      | Forms, navigation, results and admin controls              |
| `src/lib/supabase`    | Cookie-bound client and server-only privileged client      |
| `src/lib/files.ts`    | File inspection and structured parsers                     |
| `src/lib/ai`          | Structured extraction, evidence validation and aggregation |
| `src/lib/jobs`        | Inngest workflow and transactional outbox dispatch         |
| `src/lib/payments.ts` | Provider interface and Stripe test implementation          |
| `src/lib/reports.ts`  | Evidence-preserving PDF/XLSX exports                       |
| `supabase/migrations` | Schema, RLS, transactional invariants and storage          |
| `tests`               | Database, parsing, calculation, export and webhook tests   |

Cost estimates use successful saved extraction token usage and explicitly configured rates. They exclude retries that did not persist, infrastructure, provider-side costs and taxes. Admin figures are bounded recent windows, labeled accordingly. They are not final profitability or revenue accounting.

## Dependency overrides

`csv-parse` uses the patched 7.x line. ExcelJS's `uuid` dependency is constrained to patched 11.1.1+ (the v4 API used by ExcelJS is retained). Mammoth's CLI-only `argparse` dependency is updated to 2.x to remove its vulnerable `sprintf-js` dependency. The application uses Mammoth's library API, not its CLI. Recheck these overrides during dependency upgrades; XLSX and DOCX library paths are covered by fixtures.
