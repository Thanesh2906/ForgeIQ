import { notFound } from 'next/navigation';
import { z } from 'zod';
import { dashboardUser } from '@/lib/dashboard';
import { check } from '@/lib/http';
import { PageHead } from '@/components/shared';
import { Results } from '@/components/results';
export default async function Analysis({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { db } = await dashboardUser();
  const job = check(await db.from('analysis_jobs').select('*').eq('id', id).maybeSingle());
  if (!job) notFound();
  const result = check(
      await db.from('analysis_results').select('result').eq('job_id', id).maybeSingle(),
    ),
    files = check(await db.from('uploaded_files').select('id,name').eq('job_id', id));
  return (
    <>
      <PageHead
        eyebrow={
          job.module_id === 'quotation'
            ? 'SUPPLIER QUOTATION INTELLIGENCE'
            : 'E-COMMERCE INTELLIGENCE'
        }
        title={job.title}
        description={`Analysis ${id.slice(0, 8)} · ${job.credits_charged} credits${job.status === 'failed' ? ' refunded' : ''}`}
      />
      <Results
        key={id}
        id={id}
        initialStatus={job.status}
        initialResult={result?.result || null}
        names={Object.fromEntries(files.map((f) => [f.id, f.name]))}
      />
    </>
  );
}
