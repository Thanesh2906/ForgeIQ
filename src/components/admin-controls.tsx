'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './actions';
type Rule = {
  module_id: string;
  credits_per_document: number;
  credits_per_image: number;
  credits_per_job: number;
  max_files: number;
};
export function AdminControls({
  rules,
  modules,
  trial,
  allowance,
}: {
  rules: Rule[];
  modules: { id: string; enabled: boolean }[];
  trial: number;
  allowance: number;
}) {
  const router = useRouter(),
    key = useRef<string | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  async function save(body: unknown) {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await api('/api/app/admin', body);
      setMessage('Configuration saved.');
      router.refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (!confirm('Change this user’s access role?')) return;
          await save({ action: 'role', userId: f.get('userId'), role: f.get('role') });
        }}
      >
        <h2>User access management</h2>
        <p>Use a user ID from the directory below. You cannot change your own role here.</p>
        <div className="grid two">
          <div className="field">
            <label htmlFor="role-user">User ID</label>
            <input id="role-user" name="userId" required />
          </div>
          <div className="field">
            <label htmlFor="role-value">Role</label>
            <select id="role-value" name="role">
              <option value="user">User</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
        </div>
        <button className="btn secondary" disabled={busy}>
          Update access role
        </button>
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      <div className="grid two">
        {rules.map((r) => (
          <form
            className="card"
            key={r.module_id}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void save({
                action: 'pricing',
                module: r.module_id,
                document: Number(f.get('document')),
                image: Number(f.get('image')),
                job: Number(f.get('job')),
                maxFiles: Number(f.get('maxFiles')),
                enabled: f.get('enabled') === 'on',
              });
            }}
          >
            <h2>{r.module_id} pricing</h2>
            <div className="grid two">
              {[
                ['document', 'Credits per document', r.credits_per_document],
                ['image', 'Credits per image', r.credits_per_image],
                ['job', 'Credits per job', r.credits_per_job],
                ['maxFiles', 'Max files per job', r.max_files],
              ].map(([name, label, value]) => (
                <div className="field" key={name}>
                  <label htmlFor={`${r.module_id}-${name}`}>{label}</label>
                  <input
                    id={`${r.module_id}-${name}`}
                    name={String(name)}
                    defaultValue={value}
                    type="number"
                    required
                    min={name === 'maxFiles' ? 1 : 0}
                    max={name === 'maxFiles' ? 10 : 1000}
                  />
                </div>
              ))}
            </div>
            <label className="row">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={modules.find((m) => m.id === r.module_id)?.enabled}
              />
              Service enabled
            </label>
            <button className="btn" disabled={busy} style={{ marginTop: 15 }}>
              Save pricing
            </button>
          </form>
        ))}
      </div>
      <div className="grid two">
        <form
          className="card"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (!key.current) key.current = crypto.randomUUID();
            if (
              await save({
                action: 'credits',
                userId: f.get('userId'),
                amount: Number(f.get('amount')),
                reason: f.get('reason'),
                requestKey: key.current,
              })
            )
              key.current = null;
          }}
        >
          <h2>Adjust user credits</h2>
          <div className="field">
            <label htmlFor="userId">User ID</label>
            <input id="userId" name="userId" required />
          </div>
          <div className="field">
            <label htmlFor="amount">Signed amount (e.g. 25 or -10)</label>
            <input id="amount" name="amount" type="number" required min={-100000} max={100000} />
          </div>
          <div className="field">
            <label htmlFor="reason">Audit reason</label>
            <input id="reason" name="reason" required minLength={5} maxLength={200} />
          </div>
          <button className="btn" disabled={busy}>
            Record adjustment
          </button>
        </form>
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void save({
              action: 'settings',
              trialCredits: Number(f.get('trial')),
              subscriptionAllowance: Number(f.get('allowance')),
            });
          }}
        >
          <h2>Account allowances</h2>
          <div className="field">
            <label htmlFor="trial">Trial credits for new accounts</label>
            <input
              id="trial"
              name="trial"
              type="number"
              defaultValue={trial}
              min={0}
              max={10000}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="allowance">Reserved subscription allowance</label>
            <input
              id="allowance"
              name="allowance"
              type="number"
              defaultValue={allowance}
              min={0}
              max={100000}
              required
            />
            <small>
              Configuration only. Recurring subscriptions and automatic grants are not enabled in
              this MVP.
            </small>
          </div>
          <button className="btn" disabled={busy}>
            Save allowances
          </button>
        </form>
      </div>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void save({
            action: 'package',
            id: f.get('id'),
            name: f.get('name'),
            credits: Number(f.get('credits')),
            amountCents: Number(f.get('amountCents')),
            currency: f.get('currency'),
            enabled: f.get('enabled') === 'on',
          });
        }}
      >
        <h2>Create or update a test credit package</h2>
        <div className="grid three">
          {[
            ['id', 'Package ID (existing ID updates it)', 'text'],
            ['name', 'Display name', 'text'],
            ['credits', 'Credits', 'number'],
            ['amountCents', 'Amount in cents', 'number'],
            ['currency', 'Currency (lowercase ISO code)', 'text'],
          ].map(([name, label, type]) => (
            <div className="field" key={name}>
              <label htmlFor={`pack-${name}`}>{label}</label>
              <input id={`pack-${name}`} name={name} type={type} required />
            </div>
          ))}
        </div>
        <label className="row">
          <input name="enabled" type="checkbox" defaultChecked />
          Enabled
        </label>
        <button className="btn" disabled={busy}>
          Save test package
        </button>
      </form>
    </div>
  );
}
