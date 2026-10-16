import { z } from 'zod';
import { identity, route, rate, check, HttpError } from '@/lib/http';
import { adminDb } from '@/lib/supabase/server';
import { excelReport, pdfReport } from '@/lib/reports';
import type { Result } from '@/lib/ai/schema';
export const runtime = 'nodejs';
export const maxDuration = 60;
export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;
  z.uuid().parse(id);
  const format = z.enum(['pdf', 'xlsx']).parse(new URL(req.url).searchParams.get('format'));
  const { db, user } = await identity();
  await rate(user.id, 'report', 10, 60);
  const row = check(
    await db
      .from('analysis_results')
      .select('result')
      .eq('job_id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
  );
  if (!row) throw new HttpError(404, 'Report is not ready or has expired.');
  const bytes = await (format === 'pdf'
    ? pdfReport(row.result as Result)
    : excelReport(row.result as Result));
  const admin = adminDb(),
    path = `${user.id}/${id}/${crypto.randomUUID()}.${format}`;
  check(
    await admin.storage.from('reports').upload(path, bytes, {
      contentType:
        format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: false,
    }),
  );
  check(
    await admin
      .from('generated_reports')
      .insert({ user_id: user.id, job_id: id, format, storage_path: path }),
  );
  const signed = check(
    await admin.storage
      .from('reports')
      .createSignedUrl(path, 60, { download: `ForgeIQ-${id.slice(0, 8)}.${format}` }),
  );
  return Response.redirect(signed.signedUrl, 303);
});
