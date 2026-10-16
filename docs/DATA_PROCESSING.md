# Data processing register — draft

This technical record supports later legal and operational review; it does not establish GDPR or international compliance.

| Data                             | Purpose                                | Location / recipients                                     | Deletion                                                                                 |
| -------------------------------- | -------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Email and profile                | Authentication and workspace access    | Supabase Auth/PostgreSQL, Vercel                          | Account deletion                                                                         |
| Original business files          | Requested analysis and evidence review | Private Supabase Storage; relevant content sent to OpenAI | File expiry, explicit deletion, or account deletion                                      |
| Extracted facts and results      | Dashboard and reports                  | Supabase PostgreSQL; processed on Vercel                  | Account retention or account deletion                                                    |
| Exported reports                 | User-requested downloads               | Private Supabase Storage                                  | Account retention or account deletion                                                    |
| Job identifiers/state            | Durable processing                     | Supabase, Inngest                                         | Application metadata until account deletion; Inngest history subject to provider policy  |
| Payment references               | Verified test credit allocation        | Stripe test environment, Supabase                         | Application account deletion; provider policies apply                                    |
| Credit ledger and audit metadata | Integrity, support and security        | Supabase PostgreSQL                                       | User ledger cascades on account deletion; minimal audit records with removed actor links may remain |

OpenAI requests set `store: false`. This does not claim zero provider retention or exemption from abuse-monitoring logs. Inngest step outputs omit document contents, but request IDs and job metadata remain in provider history. Provider contracts, backup retention, log controls, region selection and data-transfer mechanisms must be reviewed before launch.

The MVP uses essential authentication cookies and a local theme preference. It does not ship advertising trackers. Add non-essential tracking only with an appropriate consent workflow and updated notice.

Unresolved operator-specific items: legal entity and contact address, jurisdictions, lawful bases, processor agreements, subprocessor disclosures, international-transfer safeguards, sensitive-data restrictions, backup deletion windows, rights-request verification, incident response, retention exceptions and final refund rules.
