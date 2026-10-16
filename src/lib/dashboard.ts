import 'server-only';
import { redirect } from 'next/navigation';
import { configured } from './config';
import { sessionDb } from './supabase/server';
import { check } from './http';
export async function dashboardUser() {
  if (!configured()) redirect('/auth/login');
  const db = await sessionDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect('/auth/login');
  const profile = check(await db.from('profiles').select('*').eq('id', user.id).single());
  return { db, user, profile };
}
export async function overview() {
  const auth = await dashboardUser();
  const [wallet, jobs, files, modules] = await Promise.all([
    auth.db.from('wallets').select('balance').eq('user_id', auth.user.id).single(),
    auth.db.from('analysis_jobs').select('*').order('created_at', { ascending: false }).limit(100),
    auth.db
      .from('uploaded_files')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'deleted'),
    auth.db.from('ai_modules').select('*'),
  ]);
  return {
    ...auth,
    wallet: check(wallet),
    jobs: check(jobs),
    fileCount: files.error ? 0 : files.count || 0,
    modules: check(modules),
  };
}
