import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHead, Services, Empty, DateText, Status } from '@/components/shared';
import { JobTable } from '@/components/job-table';
import { AccountSettings, Checkout, FileActions } from '@/components/actions';
import { dashboardUser } from '@/lib/dashboard';
import { check } from '@/lib/http';
const titles: Record<string, [string, string]> = {
  services: ['AI services', 'Choose the right lens for your business evidence.'],
  analyses: ['Your analyses', 'Track processing and revisit your findings.'],
  uploads: ['Source documents', 'Your private files, with secure download and deletion controls.'],
  reports: ['Generated reports', 'Export completed analyses as PDF or Excel.'],
  wallet: ['Credit wallet', 'A single balance for every ForgeIQ service.'],
  billing: ['Billing', 'Test purchases and payment history. Real payments are disabled.'],
  settings: [
    'Account settings',
    'Your profile, data processing preferences and retention controls.',
  ],
};
export default async function Section({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!titles[section]) notFound();
  const { db, user, profile } = await dashboardUser();
  let content: React.ReactNode;
  if (section === 'services') {
    const modules = check(await db.from('ai_modules').select('*'));
    content = <Services disabled={modules.filter((m) => !m.enabled).map((m) => m.id)} />;
  } else if (section === 'analyses') {
    const jobs = check(
      await db
        .from('analysis_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
    );
    content = (
      <div className="card" style={{ padding: 0 }}>
        <JobTable jobs={jobs} />
      </div>
    );
  } else if (section === 'uploads') {
    const files = check(
      await db
        .from('uploaded_files')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
    );
    content = (
      <div className="card" style={{ padding: 0 }}>
        {files.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Size</th>
                  <th>Status</th>
                  <th>Expires (UTC)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id}>
                    <td>{f.name}</td>
                    <td>{(f.size_bytes / 1024).toFixed(0)} KB</td>
                    <td>
                      <Status status={f.status} />
                    </td>
                    <td>
                      <DateText value={f.expires_at} />
                    </td>
                    <td>
                      <FileActions id={f.id} deleted={f.status === 'deleted'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No documents yet" description="Upload files when starting an analysis." />
        )}
      </div>
    );
  } else if (section === 'reports') {
    const rows = check(
      await db
        .from('analysis_results')
        .select('job_id,created_at')
        .order('created_at', { ascending: false })
        .limit(100),
    );
    content = (
      <div className="card">
        {rows.length ? (
          <div className="stack">
            {rows.map((r) => (
              <div className="between wrap file-row" key={r.job_id}>
                <div>
                  <Link href={`/dashboard/analyses/${r.job_id}`} className="link">
                    Analysis {r.job_id.slice(0, 8)}
                  </Link>
                  <p style={{ margin: 0 }}>
                    <DateText value={r.created_at} />
                  </p>
                </div>
                <div className="row">
                  <a
                    className="btn secondary small"
                    href={`/api/app/analyses/${r.job_id}/report?format=pdf`}
                  >
                    Download PDF
                  </a>
                  <a
                    className="btn secondary small"
                    href={`/api/app/analyses/${r.job_id}/report?format=xlsx`}
                  >
                    Download Excel
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="Your reports will appear here"
            description="Complete an analysis to download a report."
          />
        )}
      </div>
    );
  } else if (section === 'wallet') {
    const wallet = check(await db.from('wallets').select('*').eq('user_id', user.id).single()),
      ledger = check(
        await db
          .from('credit_transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
      );
    content = (
      <div className="stack">
        <div className="card">
          <div className="eyebrow">AVAILABLE BALANCE</div>
          <div className="metric">
            {wallet.balance} <small style={{ fontSize: 16 }}>credits</small>
          </div>
          <p>
            Charges are reserved when an analysis begins. Failed analyses are refunded
            automatically.
          </p>
          <Link className="btn" href="/dashboard/billing">
            Explore test packages
          </Link>
        </div>
        <div className="card table-wrap">
          <h2>Transaction history</h2>
          <table>
            <thead>
              <tr>
                <th>Movement</th>
                <th>Credits</th>
                <th>Details</th>
                <th>Date (UTC)</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((l) => (
                <tr key={l.id}>
                  <td>{l.kind}</td>
                  <td>
                    {l.amount > 0 ? '+' : ''}
                    {l.amount}
                  </td>
                  <td>{l.description}</td>
                  <td>
                    <DateText value={l.created_at} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  } else if (section === 'billing') {
    const packages = check(await db.from('credit_packages').select('*').eq('enabled', true)),
      payments = check(
        await db
          .from('payment_transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
      );
    content = (
      <div className="stack">
        <p className="notice">
          Test environment only. These are configurable example prices, not final commercial offers.
          Returning from checkout does not add credits; the verified payment webhook does.
        </p>
        <div className="grid two">
          {packages.map((p) => (
            <div className="card" key={p.id}>
              <span className="pill">Stripe test mode</span>
              <h2 style={{ marginTop: 16 }}>{p.name}</h2>
              <div className="metric">
                {p.credits} <small style={{ fontSize: 16 }}>credits</small>
              </div>
              <p>
                {p.currency.toUpperCase()} {(p.amount_cents / 100).toFixed(2)} test amount
              </p>
              <Checkout id={p.id} enabled={process.env.PAYMENTS_ENABLED === 'true'} />
            </div>
          ))}
        </div>
        <div className="card table-wrap">
          <h2>Payment history</h2>
          {payments.length ? (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Credits</th>
                  <th>Refunded</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id.slice(0, 8)}</td>
                    <td>
                      <Status status={p.status} />
                    </td>
                    <td>
                      {p.currency.toUpperCase()} {(p.amount_cents / 100).toFixed(2)}
                    </td>
                    <td>{p.credits}</td>
                    <td>{(p.refunded_cents / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No payments yet.</p>
          )}
        </div>
      </div>
    );
  } else
    content = (
      <div style={{ maxWidth: 750 }}>
        <AccountSettings
          name={profile.full_name}
          retention={profile.retention_days}
          consent={!!profile.consent_at}
        />
      </div>
    );
  return (
    <>
      <PageHead eyebrow="WORKSPACE" title={titles[section][0]} description={titles[section][1]} />
      {content}
      <p style={{ marginTop: 24 }}>
        <small>History lists show the most recent 100 entries.</small>
      </p>
    </>
  );
}
