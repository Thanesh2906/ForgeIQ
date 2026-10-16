import { notFound } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
import { Brand } from '@/components/shared';
import { configured } from '@/lib/config';
export default async function Auth({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  if (!['login', 'signup', 'forgot', 'reset'].includes(mode)) notFound();
  return (
    <main className="auth-shell">
      <div className="auth-story">
        <Brand />
        <div className="eyebrow" style={{ marginTop: 60 }}>
          YOUR NEXT CHAPTER, INFORMED
        </div>
        <h1 style={{ marginTop: 18 }}>
          Make room for
          <br />
          better decisions.
        </h1>
        <p>Bring your documents. Find the signal. Move forward with evidence.</p>
        <blockquote>
          One workspace for supplier comparisons, customer insights and the details that matter.
        </blockquote>
        <small>Private storage · Source references · Shared credit wallet</small>
      </div>
      <div className="stack">
        <div className="mobile-menu">
          <Brand />
        </div>
        <AuthForm mode={mode} enabled={configured()} />
      </div>
    </main>
  );
}
