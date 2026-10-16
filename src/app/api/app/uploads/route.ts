import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { identity, route, rate, check, HttpError } from '@/lib/http';
import { adminDb } from '@/lib/supabase/server';
import { fileMetadata } from '@/lib/files';
export const POST = route(async (req) => {
  const { user, profile } = await identity();
  await rate(user.id, 'upload', 20, 3600);
  const data = z
    .object({ name: z.string().min(1).max(180), size: z.number().int().positive() })
    .parse(await req.json());
  if (!profile.consent_at)
    throw new HttpError(409, 'Accept the data processing notice in Settings before uploading.');
  let meta;
  try {
    meta = fileMetadata(data.name, data.size);
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
  const db = adminDb();
  const { count, error } = await db
    .from('uploaded_files')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .neq('status', 'deleted');
  if (error) throw error;
  if ((count || 0) >= 100)
    throw new HttpError(409, 'Storage limit reached. Delete old files first.');
  const id = randomUUID(),
    path = `${user.id}/${id}.${meta.ext}`;
  check(
    await db.from('uploaded_files').insert({
      id,
      user_id: user.id,
      name: data.name,
      size_bytes: data.size,
      mime_type: meta.mime,
      storage_path: path,
      expires_at: new Date(
        Date.now() +
          Math.min(profile.retention_days, Number(process.env.FILE_RETENTION_DAYS) || 30) *
            86400000,
      ).toISOString(),
    }),
  );
  const signed = check(
    await db.storage.from('documents').createSignedUploadUrl(path, { upsert: false }),
  );
  return Response.json({
    id,
    path,
    token: signed.token,
    signedUrl: signed.signedUrl,
    mime: meta.mime,
  });
});
