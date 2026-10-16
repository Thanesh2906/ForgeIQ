'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/browser';
export function AuthForm({ mode, enabled }: { mode: string; enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const signup = mode === 'signup',
    forgot = mode === 'forgot',
    reset = mode === 'reset';
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const data = new FormData(e.currentTarget),
      email = String(data.get('email') || ''),
      password = String(data.get('password') || '');
    try {
      const db = browserDb();
      if (signup) {
        const { error } = await db.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: String(data.get('name')) },
            emailRedirectTo: `${location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setMessage('Check your email to confirm your account, then sign in.');
      } else if (forgot) {
        const { error } = await db.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/auth/callback?next=/auth/reset`,
        });
        if (error) throw error;
        setMessage('If this email is registered, a password reset link has been sent.');
      } else if (reset) {
        const { error } = await db.auth.updateUser({ password });
        if (error) throw error;
        router.push('/dashboard');
        router.refresh();
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/dashboard');
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="card">
      <h2>
        {signup
          ? 'Create your workspace'
          : forgot
            ? 'Reset your password'
            : reset
              ? 'Choose a new password'
              : 'Welcome back'}
      </h2>
      <p>
        {signup
          ? 'Start turning your documents into decisions.'
          : 'Your business intelligence, all in one place.'}
      </p>
      {!enabled && (
        <p className="notice">
          Authentication needs Supabase configuration. Follow the repository setup guide to connect
          your project.
        </p>
      )}
      <form onSubmit={submit}>
        {signup && (
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input id="name" name="name" autoComplete="name" required maxLength={120} />
          </div>
        )}
        {!reset && (
          <div className="field">
            <label htmlFor="email">Work email</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
        )}
        {!forgot && (
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={signup || reset ? 'new-password' : 'current-password'}
              minLength={12}
              required
            />
            {(signup || reset) && <small>Use at least 12 characters.</small>}
          </div>
        )}
        {signup && (
          <p style={{ fontSize: 12 }}>
            By creating an account, you acknowledge the{' '}
            <Link className="link" href="/terms">
              draft terms
            </Link>{' '}
            and{' '}
            <Link className="link" href="/privacy">
              privacy notice
            </Link>
            .
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="success">
            {message}
          </p>
        )}
        <button disabled={!enabled || busy} className="btn" style={{ width: '100%' }}>
          {busy
            ? 'Please wait…'
            : signup
              ? 'Create account'
              : forgot
                ? 'Send reset link'
                : reset
                  ? 'Update password'
                  : 'Sign in'}
        </button>
      </form>
      <div className="divider" />
      <div className="between">
        <Link className="link" href={signup ? '/auth/login' : '/auth/signup'}>
          {signup ? 'Already have an account?' : 'Create an account'}
        </Link>
        <Link href="/auth/forgot" className="muted">
          Forgot password?
        </Link>
      </div>
    </div>
  );
}
