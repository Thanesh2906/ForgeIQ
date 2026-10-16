import 'server-only';
import { adminDb } from '../supabase/server';
import { check } from '../http';
import { inngest } from './client';
export async function dispatch() {
  const db = adminDb();
  const rows = check(await db.rpc('claim_outbox')) as { job_id: string; attempts: number }[];
  let sent = 0;
  for (const row of rows) {
    try {
      await inngest.send({
        id: `analysis-${row.job_id}`,
        name: 'forgeiq/analysis.requested',
        data: { jobId: row.job_id },
      });
      check(
        await db
          .from('job_outbox')
          .update({ dispatched_at: new Date().toISOString(), lease_until: null })
          .eq('job_id', row.job_id),
      );
      sent++;
    } catch {
      console.error('dispatch.failed', { jobId: row.job_id, attempt: row.attempts });
      if (row.attempts >= 10) {
        check(await db.rpc('fail_analysis', { p_job: row.job_id, p_code: 'QUEUE_UNAVAILABLE' }));
        check(
          await db
            .from('job_outbox')
            .update({ dispatched_at: new Date().toISOString() })
            .eq('job_id', row.job_id),
        );
      } else
        check(await db.from('job_outbox').update({ lease_until: null }).eq('job_id', row.job_id));
    }
  }
  return { sent };
}
