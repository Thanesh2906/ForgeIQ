# Verification and staging acceptance

## Automated checks

`npm test` exercises the full migration in PostgreSQL WASM with minimal auth/storage fixtures. Tests cover signup defaults, RLS isolation, client mutation denial, credit idempotency, duplicate and foreign files, failure/refund terminal guards, retry charges, admin access, overdraw prevention, payment amount validation, duplicate payment events, cumulative refunds, rate limits and deletion guards. File and export tests cover content spoofing, CSV/XLSX parsing, currency/specification separation, evidence validation, literal spreadsheet strings and valid PDFs. Webhook tests use explicitly fake test keys and real signature construction, including unsigned/forged, unpaid and live-mode rejection.

`npm run test:db` is an optional multi-connection PostgreSQL concurrency test requiring an explicitly disposable migrated database. PGlite does not establish real multi-connection lock behavior by itself.

## Required cloud staging checks

Use non-sensitive fixtures and two different verified users:

1. Sign up, confirm email, log in, refresh the session, log out, request reset and set a new password. Check mobile and keyboard navigation, light/dark contrast and focus indicators.
2. Before processing consent, confirm uploads fail. After consent, upload a real PDF, scanned PDF, PNG, JPEG, WEBP, CSV, XLSX and DOCX. Confirm progress and validation errors. Try a renamed executable, oversized input, huge workbook and corrupt/encrypted Office archive.
3. Run a supplier job with two similar quotations, a different currency, missing warranty, and unequal quantities. Compare every extracted number and source reference manually. Do not treat a model-generated citation as independently verified proof.
4. Run an e-commerce job with explicit rows, duplicate records, screenshots and incomplete financial data. Ensure no unsupported revenue or aggregate loss is asserted. Review overlapping categories and count limitations.
5. Close the browser during a job. Reopen and confirm durable completion. Interrupt dispatch, restore the service, verify outbox recovery. Force model errors and confirm one refund. Replay the event and the API idempotency key.
6. As user B, request user A's job/file/report IDs and query tables directly with the anon key plus B's JWT. Verify no data or signed URL is returned. Attempt direct wallet, profile-role and job mutation.
7. Download PDF and Excel and review all values, labels and references. PDF embeds DejaVu Sans; unsupported glyphs are rendered as explicit Unicode code points so information is not silently dropped. For CJK/Tamil presentation-quality PDFs, supply and test a suitably licensed broad-coverage font.
8. Enable Stripe test checkout. Pay, replay signed events, delay events, send unpaid events, test failure, then partial and full refunds. Verify amount/currency matching, no duplicate credits and no negative wallet. Do not test live keys.
9. Adjust pricing and credits as admin, test non-admin denial, check audit entries and bounded statistics. Unknown rate estimates must remain unknown.
10. Delete a source file while a job is active (must reject), then after completion. Run retention with expired objects, verify results/exports cleanup and no source remains accessible by a newly requested URL. Existing signed links may survive briefly until object removal.
11. Delete an account, interrupt and retry, and verify auth removal, storage removal and cascaded database removal. Test upload/job creation racing against deletion. Provider backups/history require separate contractual verification.
12. Run the real PostgreSQL multi-connection test on a disposable project and review hosting/provider operational logs without exposing customer documents.

## Verification limits in the delivery environment

No Supabase/OpenAI/Inngest/Stripe credentials were supplied. Live provider and deployment tests require the owner's setup. No browser-control capability was available, so visual browser QA and real email/auth/upload interactions were not performed. The repository includes CI; its remote run status must be checked after pushing.
