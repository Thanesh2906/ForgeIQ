import { z } from 'zod';
import { identity, route, rate, check } from '@/lib/http';
import { adminDb } from '@/lib/supabase/server';
import { dispatch } from '@/lib/jobs/dispatch';
export const POST = route(async (req) => {
  const { user } = await identity();
  await rate(user.id, 'analysis', 10, 3600);
  const body = z
    .object({
      module: z.enum(['quotation', 'ecommerce']),
      title: z.string().trim().min(1).max(120),
      fileIds: z.array(z.uuid()).min(1).max(10),
      requestKey: z.uuid(),
    })
    .parse(await req.json());
  const id = check(
    await adminDb().rpc('begin_analysis', {
      p_user: user.id,
      p_module: body.module,
      p_title: body.title,
      p_files: body.fileIds,
      p_request: body.requestKey,
    }),
  );
  try {
    await dispatch();
  } catch {
    console.error('outbox.retry-required');
  }
  return Response.json({ id }, { status: 202 });
});
