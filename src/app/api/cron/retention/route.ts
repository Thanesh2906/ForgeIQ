import { cronAllowed } from '@/lib/cron';
import { adminDb } from '@/lib/supabase/server';
import { check } from '@/lib/http';
export const maxDuration = 300;
export async function GET(req: Request) {
  if (!cronAllowed(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const db = adminDb();
  let deleted = 0;
  const files = check(await db.rpc('expired_files')) as {
    id: string;
    user_id: string;
    storage_path: string;
  }[];
  for (const file of files) {
    const prepared = await db.rpc('prepare_file_deletion', {
      p_user: file.user_id,
      p_file: file.id,
    });
    if (prepared.error) {
      if (prepared.error.message.includes('ACTIVE_JOB_LIMIT')) continue;
      throw prepared.error;
    }
    check(await db.storage.from('documents').remove([file.storage_path]));
    check(await db.from('uploaded_files').update({ status: 'deleted' }).eq('id', file.id));
    check(await db.from('document_extractions').delete().eq('file_id', file.id));
    deleted++;
  }
  const reports = check(await db.rpc('expired_reports')) as { id: string; storage_path: string }[];
  if (reports.length) {
    check(await db.storage.from('reports').remove(reports.map((r) => r.storage_path)));
    check(
      await db
        .from('generated_reports')
        .delete()
        .in(
          'id',
          reports.map((r) => r.id),
        ),
    );
  }
  check(await db.rpc('purge_expired_results'));
  check(
    await db
      .from('rate_limits')
      .delete()
      .lt('reset_at', new Date(Date.now() - 86400000).toISOString()),
  );
  // Fence lost failure notifications; terminal jobs cannot publish late results.
  const stale = check(
    await db
      .from('analysis_jobs')
      .select('id')
      .in('status', ['queued', 'processing'])
      .lt('updated_at', new Date(Date.now() - 86400000).toISOString())
      .limit(100),
  );
  for (const j of stale)
    check(await db.rpc('fail_analysis', { p_job: j.id, p_code: 'JOB_TIMEOUT' }));
  return Response.json({
    deleted,
    reportsDeleted: reports.length,
    staleRefunded: stale.length,
    moreMayRemain: files.length === 200 || reports.length === 200 || stale.length === 100,
  });
}
