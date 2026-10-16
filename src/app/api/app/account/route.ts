import { z } from 'zod';
import { identity, route, check, HttpError } from '@/lib/http';
import { sessionDb, adminDb } from '@/lib/supabase/server';
export const maxDuration = 60;
export const PATCH = route(async (req) => {
  const { user } = await identity();
  const body = z
    .object({
      fullName: z.string().trim().max(120),
      retentionDays: z.number().int().min(1).max(90),
      consent: z.boolean(),
    })
    .parse(await req.json());
  const db = adminDb();
  check(
    await db
      .from('profiles')
      .update({
        full_name: body.fullName,
        retention_days: body.retentionDays,
        consent_at: body.consent ? new Date().toISOString() : null,
      })
      .eq('id', user.id),
  );
  const expiry = new Date(Date.now() + body.retentionDays * 86400000).toISOString();
  check(
    await db
      .from('uploaded_files')
      .update({ expires_at: expiry })
      .eq('user_id', user.id)
      .gt('expires_at', expiry),
  );
  check(
    await db.from('audit_logs').insert({
      actor_id: user.id,
      action: 'account.settings-updated',
      metadata: { retentionDays: body.retentionDays, consent: body.consent },
    }),
  );
  return Response.json({ saved: true });
});
export const DELETE = route(async (req) => {
  const { confirmation } = z.object({ confirmation: z.literal('DELETE') }).parse(await req.json());
  void confirmation;
  const db = await sessionDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new HttpError(401, 'Sign in first.');
  const admin = adminDb();
  check(await admin.rpc('request_deletion', { p_user: user.id }));
  for (const [table, bucket] of [
    ['uploaded_files', 'documents'],
    ['generated_reports', 'reports'],
  ] as const) {
    let removed = 0;
    for (;;) {
      const rows = check(
        await admin.from(table).select('id,storage_path').eq('user_id', user.id).limit(100),
      );
      if (!rows.length) break;
      check(await admin.storage.from(bucket).remove(rows.map((x) => x.storage_path)));
      check(
        await admin
          .from(table)
          .delete()
          .in(
            'id',
            rows.map((x) => x.id),
          ),
      );
      removed += rows.length;
      if (removed > 1000) throw new HttpError(409, 'Deletion is in progress. Retry to continue.');
    }
  }
  check(await admin.auth.admin.deleteUser(user.id));
  await db.auth.signOut();
  return Response.json({ deleted: true });
});
