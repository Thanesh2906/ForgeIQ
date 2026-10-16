'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UploadCloud, FileText, LoaderCircle, ArrowRight } from 'lucide-react';
import { api } from './actions';
type Pricing = {
  credits_per_document: number;
  credits_per_image: number;
  credits_per_job: number;
  max_files: number;
};
type Item = { file: File; id?: string; progress: number; status: string; error?: string };
export function UploadForm({
  module,
  pricing,
  balance,
  consent,
  maxBytes,
}: {
  module: string;
  pricing: Pricing;
  balance: number;
  consent: boolean;
  maxBytes: number;
}) {
  const [items, setItems] = useState<Item[]>([]),
    [title, setTitle] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const key = useRef<string | null>(null);
  const router = useRouter();
  const cost =
    pricing.credits_per_job +
    items.reduce(
      (sum, i) =>
        sum +
        (/\.(png|jpe?g|webp)$/i.test(i.file.name)
          ? pricing.credits_per_image
          : pricing.credits_per_document),
      0,
    );
  function update(index: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  async function run() {
    setBusy(true);
    setError('');
    const ids: string[] = [];
    try {
      if (!key.current) key.current = crypto.randomUUID();
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.id && item.status === 'ready') {
          ids.push(item.id);
          continue;
        }
        update(i, { status: 'Uploading', error: undefined });
        try {
          const signed = await api('/api/app/uploads', {
            name: item.file.name,
            size: item.file.size,
          });
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', signed.signedUrl);
            xhr.setRequestHeader('Content-Type', signed.mime);
            xhr.setRequestHeader('x-upsert', 'false');
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable)
                update(i, { progress: Math.round((e.loaded / e.total) * 100) });
            };
            xhr.onload = () =>
              xhr.status >= 200 && xhr.status < 300
                ? resolve()
                : reject(new Error('Upload failed. Please retry.'));
            xhr.onerror = () => reject(new Error('Network error during upload.'));
            xhr.timeout = 120000;
            xhr.ontimeout = () => reject(new Error('Upload timed out.'));
            xhr.send(item.file);
          });
          update(i, { status: 'Validating', progress: 100 });
          await api(`/api/app/uploads/${signed.id}`, {});
          update(i, { id: signed.id, status: 'ready' });
          ids.push(signed.id);
        } catch (e) {
          update(i, { status: 'failed', error: (e as Error).message });
          throw e;
        }
      }
      const job = await api('/api/app/analyses', {
        module,
        title,
        fileIds: ids,
        requestKey: key.current,
      });
      router.push(`/dashboard/analyses/${job.id}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid two" style={{ alignItems: 'start', gridTemplateColumns: undefined }}>
      <div className="card">
        <h2>Bring your source documents</h2>
        <p>
          Upload related documents together. Clear scans and complete datasets produce more useful
          findings.
        </p>
        {!consent && (
          <p className="notice">
            First review and accept the processing notice in{' '}
            <Link className="link" href="/dashboard/settings">
              Settings
            </Link>
            .
          </p>
        )}
        <div className="field">
          <label htmlFor="title">Analysis name</label>
          <input
            id="title"
            value={title}
            disabled={busy}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder={
              module === 'quotation'
                ? 'e.g. Warehouse equipment · October'
                : 'e.g. Product returns · September'
            }
          />
        </div>
        <div className="dropzone">
          <UploadCloud size={30} style={{ margin: '0 auto 10px', color: 'var(--brand)' }} />
          <h3 style={{ marginBottom: 4 }}>Choose your files</h3>
          <small>PDF, PNG, JPG, WEBP, XLSX, CSV or DOCX</small>
          <input
            aria-label="Source files"
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.csv,.docx"
            disabled={busy}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              setError('');
              key.current = null;
              if (files.length > pricing.max_files) {
                setError(`Select at most ${pricing.max_files} files.`);
                return;
              }
              if (files.some((f) => f.size > maxBytes || f.size === 0)) {
                setError(
                  `Files must be non-empty and at most ${Math.floor(maxBytes / 1024 / 1024)} MB each.`,
                );
                return;
              }
              setItems(files.map((file) => ({ file, progress: 0, status: 'pending' })));
            }}
          />
          <p style={{ fontSize: 11, margin: '12px 0 0' }}>
            Up to {pricing.max_files} files · {Math.floor(maxBytes / 1024 / 1024)} MB each · 5,000
            spreadsheet rows
          </p>
        </div>
        {items.map((item, i) => (
          <div className="file-row" key={`${item.file.name}-${i}`}>
            <div className="between">
              <span className="row">
                <FileText size={16} />
                {item.file.name}
              </span>
              <small>{item.status}</small>
            </div>
            {item.progress > 0 && (
              <progress
                value={item.progress}
                max={100}
                aria-label={`Upload progress for ${item.file.name}`}
              />
            )}{' '}
            {item.error && <small style={{ color: '#a33' }}>{item.error}</small>}
          </div>
        ))}
        {error && (
          <p className="error" role="alert" style={{ marginTop: 18 }}>
            {error}
          </p>
        )}
        <button
          className="btn"
          style={{ width: '100%', marginTop: 22 }}
          disabled={busy || !items.length || !title.trim() || !consent || cost > balance}
          onClick={run}
        >
          {busy ? (
            <>
              <LoaderCircle size={16} className="spinner" />
              Uploading and preparing…
            </>
          ) : (
            <>
              Start analysis · {cost} credits <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
      <div className="stack">
        <div className="card">
          <div className="eyebrow">BEFORE YOU START</div>
          <h2 style={{ marginTop: 13 }}>Know your cost.</h2>
          <div className="between">
            <span>Processing job</span>
            <strong>{pricing.credits_per_job} credits</strong>
          </div>
          <div className="between">
            <span>Per document</span>
            <strong>{pricing.credits_per_document} credits</strong>
          </div>
          <div className="between">
            <span>Per image</span>
            <strong>{pricing.credits_per_image} credits</strong>
          </div>
          <div className="divider" />
          <div className="between">
            <span>Estimated total</span>
            <strong>{cost} credits</strong>
          </div>
          <div className="between">
            <small>Your wallet</small>
            <small>{balance} credits</small>
          </div>
          {cost > balance && (
            <p className="error">Your balance is too low. Visit your credit wallet.</p>
          )}
          <p style={{ marginTop: 18, marginBottom: 0, fontSize: 12 }}>
            The server checks current prices before charging. Failed jobs receive an automatic
            credit refund.
          </p>
        </div>
        <div className="notice">
          <strong>Keep your evidence focused</strong>
          <p style={{ margin: '8px 0 0' }}>
            Only upload files relevant to this analysis. Remove unnecessary personal data. Uploaded
            content is treated as evidence, never as instructions.
          </p>
        </div>
      </div>
    </div>
  );
}
