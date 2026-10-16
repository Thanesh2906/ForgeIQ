import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashboardUser } from '@/lib/dashboard';
import { adminDb } from '@/lib/supabase/server';
import { check } from '@/lib/http';
import { Brand, PageHead, Status } from '@/components/shared';
import { AdminControls } from '@/components/admin-controls';
import { ThemeToggle } from '@/components/theme';
export const dynamic = 'force-dynamic';
export default async function Admin() {
  const { profile } = await dashboardUser();
  if (profile.role !== 'admin') redirect('/dashboard');
  const db = adminDb();
  const results = await Promise.all([
    db
      .from('profiles')
      .select('id,email,full_name,role,created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    db.from('analysis_jobs').select('*').order('created_at', { ascending: false }).limit(100),
    db
      .from('document_extractions')
      .select('model,input_tokens,output_tokens,estimated_cost_usd')
      .order('created_at', { ascending: false })
      .limit(1000),
    db.from('pricing_rules').select('*'),
    db.from('ai_modules').select('*'),
    db.from('platform_settings').select('*').single(),
    db.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100),
    db
      .from('payment_transactions')
      .select('status,amount_cents,currency,refunded_cents')
      .order('created_at', { ascending: false })
      .limit(1000),
    db.from('wallets').select('user_id,balance').limit(1000),
  ]);
  const [users, jobs, usage, rules, modules, settings, logs, payments, wallets] = results.map((r) =>
    check(r),
  ) as [
    Record<string, string>[],
    { id: string; title: string; status: string; error_code: string | null }[],
    { input_tokens: number; output_tokens: number; estimated_cost_usd: number | null }[],
    {
      module_id: string;
      credits_per_document: number;
      credits_per_image: number;
      credits_per_job: number;
      max_files: number;
    }[],
    { id: string; enabled: boolean }[],
    { trial_credits: number; subscription_allowance: number },
    { id: string; action: string; target_id: string; created_at: string }[],
    { status: string; amount_cents: number; currency: string; refunded_cents: number }[],
    { user_id: string; balance: number }[],
  ];
  const revenue = payments
    .filter((p) => ['paid', 'refunded'].includes(p.status))
    .reduce<Record<string, number>>(
      (a, p) => ({ ...a, [p.currency]: (a[p.currency] || 0) + p.amount_cents - p.refunded_cents }),
      {},
    );
  return (
    <main style={{ maxWidth: 1250, padding: 30, margin: 'auto' }}>
      <div className="between" style={{ marginBottom: 35 }}>
        <Brand />
        <div className="row">
          <Link className="btn secondary" href="/dashboard">
            Back to workspace
          </Link>
          <ThemeToggle />
        </div>
      </div>
      <PageHead
        eyebrow="ADMINISTRATION"
        title="Platform control room"
        description="Configuration, usage and processing health. All mutations require a server-verified admin role."
      />
      <div className="grid four">
        {[
          ['Users (latest 100)', users.length],
          ['Jobs (latest 100)', jobs.length],
          ['Failures in listed jobs', jobs.filter((j) => j.status === 'failed').length],
          [
            'Known API cost · USD',
            usage
              .filter((u) => u.estimated_cost_usd !== null)
              .reduce((sum, u) => sum + Number(u.estimated_cost_usd), 0)
              .toFixed(4),
          ],
        ].map(([label, value]) => (
          <div className="card" key={label}>
            <small>{label}</small>
            <div className="metric">{value}</div>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 12 }}>
        <small>
          Usage and payment figures cover the latest 1,000 records, not lifetime totals.{' '}
          {usage.filter((u) => u.estimated_cost_usd === null).length} cost records have unknown
          rates. Recorded tokens:{' '}
          {usage.reduce((a, u) => a + u.input_tokens + u.output_tokens, 0).toLocaleString()}.
        </small>
      </p>
      <div className="card" style={{ margin: '24px 0' }}>
        <h2>Configuration health</h2>
        <div className="grid three">
          {[
            ['Supabase', !!process.env.SUPABASE_SERVICE_ROLE_KEY],
            ['OpenAI', !!process.env.OPENAI_API_KEY],
            ['Inngest', !!process.env.INNGEST_SIGNING_KEY],
            ['Cron protection', !!process.env.CRON_SECRET],
            ['Stripe test key', process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')],
            ['Payments enabled', process.env.PAYMENTS_ENABLED === 'true'],
          ].map(([key, value]) => (
            <div className="between" key={String(key)}>
              <span>{key}</span>
              <Status status={value ? 'configured' : 'not_configured'} />
            </div>
          ))}
        </div>
        <small>Presence checks only; these do not verify provider connectivity.</small>
        <div className="divider" />
        <h3>Net test payment totals, by currency</h3>
        {Object.entries(revenue).length ? (
          Object.entries(revenue).map(([currency, amount]) => (
            <p key={currency}>
              {currency.toUpperCase()} {(amount / 100).toFixed(2)}
            </p>
          ))
        ) : (
          <p>No verified test payments yet.</p>
        )}
      </div>
      <AdminControls
        rules={rules}
        modules={modules}
        trial={settings.trial_credits}
        allowance={settings.subscription_allowance}
      />
      <section className="card table-wrap" style={{ marginTop: 24 }}>
        <h2>User directory</h2>
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>ID</th>
              <th>Role</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.full_name}
                  <br />
                  <small>{u.email}</small>
                </td>
                <td>{u.id}</td>
                <td>{u.role}</td>
                <td>{wallets.find((w) => w.user_id === u.id)?.balance ?? 'Not loaded'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card table-wrap" style={{ marginTop: 24 }}>
        <h2>Processing monitor</h2>
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Status</th>
              <th>Error code</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td>
                  {j.title}
                  <br />
                  <small>{j.id}</small>
                </td>
                <td>
                  <Status status={j.status} />
                </td>
                <td>{j.error_code || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card table-wrap" style={{ marginTop: 24 }}>
        <h2>Audit trail</h2>
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Target</th>
              <th>Time (UTC)</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{l.action}</td>
                <td>{l.target_id || '—'}</td>
                <td>{l.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
