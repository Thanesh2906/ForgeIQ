import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { sessionDb, adminDb } from '@/lib/supabase/server';
import { appUrl } from '@/lib/config';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function check<T extends { data: unknown; error: { message: string } | null }>(
  result: T,
): Extract<T, { error: null }>['data'] {
  if (result.error) throw new Error(result.error.message);
  return result.data as Extract<T, { error: null }>['data'];
}
export async function identity(admin = false) {
  const db = await sessionDb();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new HttpError(401, 'Please sign in.');
  const profile = check(await db.from('profiles').select('*').eq('id', user.id).single());
  if (admin && profile.role !== 'admin') throw new HttpError(403, 'Administrator access required.');
  if (profile.deletion_requested_at) throw new HttpError(403, 'Account deletion is in progress.');
  return { db, user, profile };
}
export async function rate(user: string, action: string, limit = 20, seconds = 60) {
  const allowed = check(
    await adminDb().rpc('take_rate_limit', {
      p_key: `${action}:${user}`,
      p_limit: limit,
      p_seconds: seconds,
    }),
  );
  if (!allowed) throw new HttpError(429, 'Too many requests. Please try again shortly.');
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (origin !== new URL(appUrl()).origin)
    throw new HttpError(403, 'Request origin is not allowed.');
}
export function route(
  handler: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>,
) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) sameOrigin(req);
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof HttpError)
        return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError)
        return NextResponse.json(
          { error: e.issues.map((x) => x.message).join('; ') },
          { status: 400 },
        );
      const message = e instanceof Error ? e.message : '';
      const known = [
        'INSUFFICIENT_CREDITS',
        'INVALID_FILES',
        'FILE_LIMIT',
        'MODULE_DISABLED',
        'ACTIVE_JOB_LIMIT',
        'CONSENT_REQUIRED',
      ];
      if (known.some((x) => message.includes(x)))
        return NextResponse.json(
          {
            error: message
              .replace(
                /.*(INSUFFICIENT_CREDITS|INVALID_FILES|FILE_LIMIT|MODULE_DISABLED|ACTIVE_JOB_LIMIT|CONSENT_REQUIRED).*/,
                '$1',
              )
              .replaceAll('_', ' '),
          },
          { status: 409 },
        );
      console.error('request.failed', { kind: e instanceof Error ? e.name : 'unknown' });
      return NextResponse.json(
        { error: 'The request could not be completed. Please retry or contact support.' },
        { status: 500 },
      );
    }
  };
}
