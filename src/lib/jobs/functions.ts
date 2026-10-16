import 'server-only';
import { inngest } from './client';
import { adminDb } from '../supabase/server';
import { check } from '../http';
import { analyzeDocument } from '../ai/analyze';
import { aggregate } from '../ai/aggregate';
import { extractionSchema } from '../ai/schema';
import type { ModuleId } from '../config';
export const analyzeJob = inngest.createFunction(
  {
    id: 'analyze-job',
    triggers: [{ event: 'forgeiq/analysis.requested' }],
    retries: 3,
    concurrency: { limit: 3 },
    idempotency: 'event.data.jobId',
    onFailure: async ({ event }) => {
      const id = event.data.event.data.jobId;
      if (typeof id === 'string')
        check(await adminDb().rpc('fail_analysis', { p_job: id, p_code: 'PROCESSING_FAILED' }));
    },
  },
  async ({ event, step }) => {
    const jobId = String(event.data.jobId);
    const job = await step.run('load-job', async () => {
      const db = adminDb();
      const j = check(await db.from('analysis_jobs').select('*').eq('id', jobId).single());
      if (j.status === 'failed' || j.status === 'completed') return null;
      check(
        await db
          .from('analysis_jobs')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', jobId)
          .eq('status', 'queued'),
      );
      return {
        id: j.id as string,
        user_id: j.user_id as string,
        module_id: j.module_id as ModuleId,
      };
    });
    if (!job) return { skipped: true };
    const files = await step.run('list-files', async () =>
      check(
        await adminDb()
          .from('uploaded_files')
          .select('id,name,mime_type,storage_path')
          .eq('job_id', job.id)
          .eq('user_id', job.user_id)
          .eq('status', 'ready'),
      ),
    );
    if (!files.length) throw new Error('NO_FILES');
    for (const file of files) {
      await step.run(`extract-${file.id}`, async () => {
        const db = adminDb();
        const existing = check(
          await db
            .from('document_extractions')
            .select('file_id')
            .eq('file_id', file.id)
            .maybeSingle(),
        );
        if (existing) return { saved: true };
        const current = check(
          await db.from('analysis_jobs').select('status').eq('id', job.id).single(),
        );
        if (current.status === 'failed') return { skipped: true };
        const blob = check(await db.storage.from('documents').download(file.storage_path));
        const analysis = await analyzeDocument(
          file,
          Buffer.from(await blob.arrayBuffer()),
          job.module_id,
        );
        check(
          await db
            .from('document_extractions')
            .upsert(
              { file_id: file.id, job_id: job.id, user_id: job.user_id, ...analysis },
              { onConflict: 'file_id' },
            ),
        );
        check(
          await db
            .from('analysis_jobs')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', job.id)
            .eq('status', 'processing'),
        );
        return { saved: true };
      });
    }
    await step.run('assemble-report', async () => {
      const db = adminDb();
      const rows = check(
        await db.from('document_extractions').select('result').eq('job_id', job.id),
      );
      if (rows.length !== files.length) throw new Error('INCOMPLETE_EXTRACTIONS');
      const result = aggregate(
        job.module_id,
        rows.map((r) => extractionSchema.parse(r.result)),
      );
      check(await db.rpc('finish_analysis', { p_job: job.id, p_result: result }));
    });
    return { jobId: job.id };
  },
);
