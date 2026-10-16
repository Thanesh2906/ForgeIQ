import Link from 'next/link';
import { Plus, ArrowUpRight, Wallet, FileSearch, Files, Activity } from 'lucide-react';
import { PageHead, Services } from '@/components/shared';
import { JobTable } from '@/components/job-table';
import { overview } from '@/lib/dashboard';
export default async function Dashboard() {
  const { profile, wallet, jobs, fileCount, modules } = await overview();
  return (
    <>
      <PageHead
        eyebrow="YOUR INTELLIGENCE WORKSPACE"
        title={`Welcome${profile.full_name ? `, ${profile.full_name.split(' ')[0]}` : ' to ForgeIQ'}.`}
        description="A clearer view of your business starts with the evidence."
        action={
          <Link className="btn" href="/dashboard/services">
            <Plus size={16} />
            New analysis
          </Link>
        }
      />
      <div className="grid four">
        {[
          {
            label: 'Available credits',
            value: wallet.balance,
            note: 'Shared across your services',
            Icon: Wallet,
          },
          { label: 'Analyses', value: jobs.length, note: 'Most recent 100 jobs', Icon: FileSearch },
          {
            label: 'Stored files',
            value: fileCount,
            note: 'Private to your workspace',
            Icon: Files,
          },
          {
            label: 'In progress',
            value: jobs.filter((j) => ['queued', 'processing'].includes(j.status)).length,
            note: 'Background processing',
            Icon: Activity,
          },
        ].map((m) => (
          <div className="card" key={m.label}>
            <div className="between">
              <small>{m.label}</small>
              <m.Icon size={16} className="muted" />
            </div>
            <div className="metric">{m.value}</div>
            <small>{m.note}</small>
          </div>
        ))}
      </div>
      <div className="between" style={{ margin: '34px 0 16px' }}>
        <h2 style={{ margin: 0 }}>Your AI services</h2>
        <span className="muted">Purpose-built for better decisions</span>
      </div>
      <Services disabled={modules.filter((m) => !m.enabled).map((m) => m.id)} />
      <section className="card" style={{ marginTop: 28, padding: 0, overflow: 'hidden' }}>
        <div className="between" style={{ padding: '22px 24px' }}>
          <div>
            <h2 style={{ margin: '0 0 3px' }}>Recent analyses</h2>
            <small>Your latest work, in one place.</small>
          </div>
          <Link className="link row" href="/dashboard/analyses">
            View all <ArrowUpRight size={15} />
          </Link>
        </div>
        <JobTable jobs={jobs.slice(0, 5)} />
      </section>
      <div className="notice row" style={{ marginTop: 24 }}>
        <span className="pill">A note on accuracy</span>
        <span>
          AI supports your judgment. Review extracted facts against their sources before making a
          decision.
        </span>
      </div>
    </>
  );
}
