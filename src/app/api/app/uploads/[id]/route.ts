import { z } from 'zod';
import { identity, route, rate, check, HttpError } from '@/lib/http';
import { adminDb } from '@/lib/supabase/server';
import { validateBytes } from '@/lib/files';
async function owned(id: string) {
  z.uuid().parse(id);
  const auth = await identity();
  const file = check(
    await auth.db
      .from('uploaded_files')
      .select('*')
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .maybeSingle(),
  );
  if (!file) throw new HttpError(404, 'File not found.');
  return { ...auth, file };
}
export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const { user, file } = await owned(id);
  await rate(user.id, 'validate-upload', 30, 3600);
  if (file.status === 'deleted') throw new HttpError(410, 'File was deleted.');
  if (file.status === 'ready') return Response.json({ ready: true });
  const db = adminDb();
  const blob = check(await db.storage.from('documents').download(file.storage_path));
  try {
    await validateBytes(file.name, Buffer.from(await blob.arrayBuffer()), file.size_bytes);
  } catch (e) {
    check(await db.storage.from('documents').remove([file.storage_path]));
    check(await db.from('uploaded_files').update({ status: 'deleted' }).eq('id', id));
    throw new HttpError(400, (e as Error).message);
  }
  check(
    await db
      .from('uploaded_files')
      .update({ status: 'ready' })
      .eq('id', id)
      .eq('status', 'pending'),
  );
  return Response.json({ ready: true });
});
export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const { file } = await owned(id);
  if (file.status !== 'ready') throw new HttpError(410, 'File is unavailable or expired.');
  const url = check(
    await adminDb()
      .storage.from('documents')
      .createSignedUrl(file.storage_path, 60, { download: file.name }),
  );
  return Response.json({ url: url.signedUrl }, { headers: { 'Cache-Control': 'no-store' } });
});
export const DELETE = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const { user, file } = await owned(id);
  const db = adminDb();
  check(await db.rpc('prepare_file_deletion', { p_user: user.id, p_file: id }));
  check(await db.storage.from('documents').remove([file.storage_path]));
  check(await db.from('uploaded_files').update({ status: 'deleted' }).eq('id', id));
  check(await db.from('document_extractions').delete().eq('file_id', id));
  check(
    await db
      .from('audit_logs')
      .insert({ actor_id: user.id, action: 'file.deleted', target_id: id }),
  );
  return Response.json({ deleted: true });
});
