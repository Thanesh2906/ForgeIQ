'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export async function api(path: string, body?: unknown, method = 'POST') {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
export function FileActions({ id, deleted }: { id: string; deleted: boolean }) {
  const router = useRouter();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function act(remove = false) {
    setBusy(true);
    setError('');
    try {
      if (remove) {
        if (
          !confirm(
            'Delete this original file? Existing reports may still contain extracted information.',
          )
        )
          return;
        await api(`/api/app/uploads/${id}`, undefined, 'DELETE');
        router.refresh();
      } else {
        const data = await api(`/api/app/uploads/${id}`, undefined, 'GET');
        location.assign(data.url);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="row">
        {!deleted && (
          <button className="btn secondary small" disabled={busy} onClick={() => act()}>
            Download
          </button>
        )}
        <button
          className="btn secondary small"
          disabled={busy || deleted}
          onClick={() => act(true)}
        >
          Delete
        </button>
      </div>
      {error && (
        <small role="alert" style={{ color: '#a33' }}>
          {error}
        </small>
      )}
    </div>
  );
}
export function Checkout({ id, enabled }: { id: string; enabled: boolean }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [key] = useState(() => crypto.randomUUID());
  return (
    <div>
      <button
        className="btn"
        disabled={busy || !enabled}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const data = await api('/api/app/billing', { packageId: id, requestKey: key });
            location.assign(data.url);
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        {busy ? 'Opening checkout…' : enabled ? 'Test checkout' : 'Test checkout not configured'}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function AccountSettings({
  name,
  retention,
  consent,
}: {
  name: string;
  retention: number;
  consent: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  return (
    <div className="stack">
      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setBusy(true);
          setError('');
          setMessage('');
          try {
            await api(
              '/api/app/account',
              {
                fullName: data.get('name'),
                retentionDays: Number(data.get('retention')),
                consent: data.get('consent') === 'on',
              },
              'PATCH',
            );
            setMessage('Your settings have been saved.');
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Your preferences</h2>
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" name="name" defaultValue={name} maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="retention">File and report retention (days)</label>
          <input
            id="retention"
            name="retention"
            type="number"
            min={1}
            max={90}
            defaultValue={retention}
            required
          />
          <small>
            1–90 days. Shorter settings shorten existing file expiry. Increasing retention does not
            restore deleted data or extend existing files.
          </small>
        </div>
        <label className="row" style={{ alignItems: 'flex-start', marginBottom: 20 }}>
          <input type="checkbox" name="consent" defaultChecked={consent} />
          <span>
            I am authorized to upload these documents and agree to their processing by ForgeIQ,
            Supabase and OpenAI as described in the draft privacy notice. I will not upload
            regulated or sensitive personal data without an approved processing agreement.
          </span>
        </label>
        <button className="btn" disabled={busy}>
          Save preferences
        </button>
        {message && (
          <p className="success" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>
      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          if (!confirm('Permanently delete this account, all uploaded files, results and reports?'))
            return;
          setBusy(true);
          setError('');
          try {
            await api('/api/app/account', { confirmation: data.get('confirmation') }, 'DELETE');
            router.push('/');
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Delete your data and account</h2>
        <p>
          Deletion removes your account, source files, derived results and generated reports. Wait
          for active jobs to finish first. If interrupted, retry this form to finish deletion.
        </p>
        <label htmlFor="confirmation">Type DELETE to confirm</label>
        <input
          id="confirmation"
          name="confirmation"
          required
          pattern="DELETE"
          placeholder="DELETE"
        />
        <button className="btn danger" disabled={busy} style={{ marginTop: 15 }}>
          Permanently delete account
        </button>
      </form>
    </div>
  );
}
