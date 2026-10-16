import { sessionDb } from '@/lib/supabase/server';
import { appUrl } from '@/lib/config';
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') === '/auth/reset' ? '/auth/reset' : '/dashboard';
  if (code) {
    const db = await sessionDb();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return Response.redirect(`${appUrl()}${next}`);
  }
  return Response.redirect(`${appUrl()}/auth/login?error=callback`);
}
