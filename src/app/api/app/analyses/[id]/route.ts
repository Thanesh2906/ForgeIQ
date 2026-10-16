import { z } from 'zod';
import { identity, route, rate, check, HttpError } from '@/lib/http';
import { adminDb } from '@/lib/supabase/server';
import { dispatch } from '@/lib/jobs/dispatch';
export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;
  z.uuid().parse(id);
  const { db, user } = await identity();
  const job = check(
    await db.from('analysis_jobs').select('*').eq('id', id).eq('user_id', user.id).maybeSingle(),
  );
  if (!job) throw new HttpError(404, 'Analysis not found.');
  const result = check(
    await db.from('analysis_results').select('result').eq('job_id', id).maybeSingle(),
  );
  return Response.json(
    { job, result: result?.result || null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
});
// Retry creates a fresh job and fresh charge; the old job has already refunded its charge.
export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  z.uuid().parse(id);
  const { db, user } = await identity();
  await rate(user.id, 'retry', 5, 3600);
  const { requestKey } = z.object({ requestKey: z.uuid() }).parse(await req.json());
  const job = check(
    await db.from('analysis_jobs').select('*').eq('id', id).eq('user_id', user.id).single(),
  );
  if (job.status !== 'failed') throw new HttpError(409, 'Only failed analyses can be retried.');
  const admin = adminDb();
  const next = check(
    await admin.rpc('retry_analysis', { p_user: user.id, p_job: id, p_request: requestKey }),
  );
  try {
    await dispatch();
  } catch {
    console.error('outbox.retry-required');
  }
  return Response.json({ id: next }, { status: 202 });
});
