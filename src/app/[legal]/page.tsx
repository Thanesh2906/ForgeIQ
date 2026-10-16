import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Brand } from '@/components/shared';
const pages: Record<string, { title: string; sections: [string, string][] }> = {
  privacy: {
    title: 'Privacy notice — draft',
    sections: [
      [
        'Status of this notice',
        'This is an unreviewed template for the ForgeIQ MVP. Before commercial launch, the operator must insert its registered legal name, address, contact email, operating jurisdictions and applicable controller/processor responsibilities. No GDPR or international compliance certification is claimed.',
      ],
      [
        'What we process',
        'Account email and profile, uploaded business documents, extracted results, job metadata, credit movements, payment references and security audit records. Do not upload sensitive personal data or regulated records without an approved processing agreement.',
      ],
      [
        'Purpose and providers',
        'Files are processed to provide the analysis you request. Supabase provides authentication, database and private storage. OpenAI receives relevant document content for AI extraction with response storage disabled in the API request. Inngest coordinates jobs using identifiers; document contents are stored in Supabase rather than step return payloads. Vercel hosts the app. Stripe handles test checkout. Provider logging and retention are governed by their contracts and settings; zero retention is not promised.',
      ],
      [
        'Retention and deletion',
        'Source files expire according to the upload-time setting, with a default 30-day cap configurable by the operator. You may shorten retention in Settings or delete source files individually. Derived results and exports follow the current account retention setting. Scheduled deletion runs daily; active jobs are skipped until terminal. Account deletion removes application data and storage. Provider backups and legally required retention need an operator-specific policy before launch.',
      ],
      [
        'Your controls',
        'You can review processing consent, adjust retention, delete files, and permanently delete your data and account in Settings. Deleting a source file alone does not erase existing derived reports. To remove all account data use account deletion. Contact details and additional statutory request procedures must be added by the operator before launch.',
      ],
      [
        'International processing',
        'Hosting regions, transfers, safeguards, subprocessors and the applicable lawful bases must be reviewed for the intended countries before collecting customer data. Accepting a checkbox does not itself establish legal compliance.',
      ],
    ],
  },
  terms: {
    title: 'Terms of service — draft',
    sections: [
      [
        'Draft agreement',
        'This template requires legal review and completion with the operating entity, support contact, governing law and dispute terms. It is not a representation that ForgeIQ meets every international legal requirement.',
      ],
      [
        'The service',
        'ForgeIQ provides AI-assisted document extraction, supplier comparison and e-commerce evidence analysis. Outputs may contain errors. Check sources before procurement, financial or other consequential decisions. No guaranteed savings, accuracy or commercial outcome is offered.',
      ],
      [
        'Your responsibilities',
        'Upload only content you are authorized to process. Do not upload malicious material, infringement, or regulated personal information without appropriate contractual and technical protections. You retain rights to your content.',
      ],
      [
        'Credits and test billing',
        'Example credit prices may change through administrator configuration. The server applies current rates when creating a job. Failed jobs refund their reserved credits. Only verified test payment events allocate purchased test credits. Real-money checkout and recurring subscriptions are disabled in this MVP.',
      ],
      [
        'Availability, deletion and changes',
        'Processing depends on third-party providers. Temporary interruptions and retention-based deletion can occur. Download required reports before expiry. Production service levels, refund rights, liability limits and change-notification terms need operator-specific review.',
      ],
    ],
  },
  cookies: {
    title: 'Cookie information',
    sections: [
      [
        'Essential authentication',
        'Supabase authentication uses browser cookies to keep you signed in and refresh your session. These cookies are needed for protected account features.',
      ],
      [
        'Display preferences',
        'The selected light or dark theme is stored in browser local storage. It does not contain uploaded business documents.',
      ],
      [
        'No analytics by default',
        'This source code does not install advertising or analytics trackers. Stripe test checkout operates on a separate hosted page and has its own cookie information. If the operator adds non-essential tracking, an appropriate consent mechanism and updated notice must be implemented first.',
      ],
    ],
  },
};
export default async function Legal({ params }: { params: Promise<{ legal: string }> }) {
  const { legal } = await params;
  const page = pages[legal];
  if (!page) notFound();
  return (
    <main className="legal">
      <Brand />
      <div className="eyebrow" style={{ marginTop: 45 }}>
        TRANSPARENCY & TRUST
      </div>
      <h1 style={{ marginTop: 14 }}>{page.title}</h1>
      <p className="notice">
        MVP documentation · Last updated 16 October 2026 · Legal review required before commercial
        launch.
      </p>
      {page.sections.map(([title, text]) => (
        <section key={title}>
          <h2>{title}</h2>
          <p>{text}</p>
        </section>
      ))}
      <Link className="btn secondary" href="/">
        Back to ForgeIQ
      </Link>
    </main>
  );
}
