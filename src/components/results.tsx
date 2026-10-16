'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, RefreshCw, Download, CheckCircle2 } from 'lucide-react';
import type { Result, Reference } from '@/lib/ai/schema';
import { api } from './actions';
import { Status } from './shared';
function Source({ source, names }: { source: Reference; names: Record<string, string> }) {
  return (
    <div className="source">
      <strong>
        {names[source.fileId] || source.fileId} · {source.location}
      </strong>
      <br />“{source.evidence}”
    </div>
  );
}
export function Results({
  id,
  initialStatus,
  initialResult,
  names,
}: {
  id: string;
  initialStatus: string;
  initialResult: Result | null;
  names: Record<string, string>;
}) {
  const [status, setStatus] = useState(initialStatus),
    [result, setResult] = useState(initialResult),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const retryKey = useRef<string | null>(null);
  const router = useRouter();
  useEffect(() => {
    if (!['queued', 'processing'].includes(status)) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const data = await api(`/api/app/analyses/${id}`, undefined, 'GET');
        if (active) {
          setStatus(data.job.status);
          setResult(data.result);
          setError('');
        }
      } catch {
        if (active) setError('Status could not refresh. Your background job may still be running.');
      }
    }, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, status]);
  if (!result)
    return (
      <div className="card empty">
        {['queued', 'processing'].includes(status) ? (
          <>
            <LoaderCircle size={32} className="spinner" />
            <h2>{status === 'queued' ? 'Your analysis is queued' : 'Reading the details'}</h2>
            <p>Processing continues in the background. You can leave this page and return later.</p>
            <Status status={status} />
          </>
        ) : status === 'failed' ? (
          <>
            <RefreshCw size={32} />
            <h2>This analysis could not complete</h2>
            <p>
              Your analysis credits have been refunded. Check that your source files are readable,
              then retry.
            </p>
            <button
              className="btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  if (!retryKey.current) retryKey.current = crypto.randomUUID();
                  const data = await api(`/api/app/analyses/${id}`, {
                    requestKey: retryKey.current,
                  });
                  router.push(`/dashboard/analyses/${data.id}`);
                  router.refresh();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Retry with a new credit charge
            </button>
          </>
        ) : (
          <>
            <h2>Report no longer available</h2>
            <p>The result may have expired under your retention settings.</p>
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>
    );
  return (
    <div className="stack">
      <div className="between wrap">
        <span className="pill">
          <CheckCircle2 size={13} />
          Analysis complete
        </span>
        <div className="row">
          <a className="btn secondary" href={`/api/app/analyses/${id}/report?format=pdf`}>
            <Download size={15} />
            PDF report
          </a>
          <a className="btn secondary" href={`/api/app/analyses/${id}/report?format=xlsx`}>
            <Download size={15} />
            Excel report
          </a>
        </div>
      </div>
      <div className="card">
        <div className="eyebrow">AI INTERPRETATION</div>
        <h2 style={{ marginTop: 10 }}>The overall picture</h2>
        <p className="report-text" style={{ margin: 0 }}>
          {result.summary}
        </p>
      </div>
      {result.metrics.length > 0 && (
        <div className="grid three">
          {result.metrics.map((m) => (
            <div className="card" key={m.label}>
              <small>{m.label}</small>
              <div className="metric">{m.value}</div>
              <span className="pill">Calculation</span>
              <p style={{ fontSize: 11, marginTop: 8 }}>{m.basis}</p>
            </div>
          ))}
        </div>
      )}
      {result.module === 'quotation' && (
        <section className="card">
          <h2>Quotation comparison</h2>
          <p>
            Extracted facts · Blank details are shown as “Not provided”. Prices retain their
            original currency.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Supplier / product</th>
                  <th>Specification</th>
                  <th>Price / quantity</th>
                  <th>Delivery / warranty</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {result.documents
                  .flatMap((d) => d.quotations)
                  .map((q, i) => (
                    <tr key={i}>
                      <td>
                        <strong>{q.supplier ?? 'Not provided'}</strong>
                        <br />
                        {q.product}
                      </td>
                      <td>{q.specification ?? 'Not provided'}</td>
                      <td>
                        {q.currency ?? 'Currency not provided'} {q.unitPrice ?? 'No unit price'} /{' '}
                        {q.unit ?? 'unknown unit'}
                        <br />
                        Quantity: {q.quantity ?? 'Not provided'}
                        <br />
                        Total: {q.total ?? 'Not provided'}
                        <br />
                        Tax/fees: {q.taxAndFees ?? 'Not provided'}
                      </td>
                      <td>
                        {q.delivery ?? 'Not provided'}
                        <br />
                        {q.warranty ?? 'Not provided'}
                      </td>
                      <td>
                        <Source source={q.source} names={names} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!result.documents.some((d) => d.quotations.length) && (
            <p>No supported quotation line items were extracted.</p>
          )}
          <h3 style={{ marginTop: 26 }}>Comparable unit price differences</h3>
          {result.comparisons.length ? (
            result.comparisons.map((c, i) => (
              <div key={i} className="notice" style={{ marginBottom: 10 }}>
                <span className="pill">Calculation</span>
                <strong> {c.product}</strong>
                <p style={{ margin: '8px 0' }}>
                  Lowest {c.currency} {c.lowest} · Highest {c.highest} · Difference {c.difference}{' '}
                  per {c.unit}
                </p>
                {c.sources.map((s, j) => (
                  <Source key={j} source={s} names={names} />
                ))}
              </div>
            ))
          ) : (
            <p>
              No directly comparable lines met the matching criteria. Review source terms before
              comparing.
            </p>
          )}
        </section>
      )}
      {result.module === 'ecommerce' && (
        <section className="card">
          <h2>Customer & product evidence</h2>
          <p>
            Extracted records and sentiment interpretations. Counts may overlap; explicit loss
            candidates require review.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product / category</th>
                  <th>Type / count</th>
                  <th>Sentiment</th>
                  <th>Explicit loss candidate</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {result.documents
                  .flatMap((d) => d.observations)
                  .map((o, i) => (
                    <tr key={i}>
                      <td>
                        {o.product ?? 'Not provided'}
                        <br />
                        <strong>{o.category}</strong>
                      </td>
                      <td>
                        {o.recordType} · {o.count}
                      </td>
                      <td>{o.sentiment}</td>
                      <td>
                        {o.financialLoss === null
                          ? 'Insufficient information'
                          : `${o.currency ?? 'Unknown currency'} ${o.financialLoss}`}
                        <br />
                        <small>{o.lossBasis}</small>
                      </td>
                      <td>
                        <Source source={o.source} names={names} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="card">
        <h2>Findings & next steps</h2>
        <div className="grid two">
          {result.findings.map((f, i) => (
            <div key={i}>
              <span className="pill">
                {f.kind === 'fact'
                  ? 'Extracted fact'
                  : f.kind === 'interpretation'
                    ? 'AI interpretation'
                    : 'AI recommendation'}
              </span>
              <h3 style={{ marginTop: 12 }}>{f.title}</h3>
              <p>{f.detail}</p>
              {f.sources.map((s, j) => (
                <Source key={j} source={s} names={names} />
              ))}
            </div>
          ))}
        </div>
      </section>
      <div className="grid two">
        <section className="card">
          <h2>Missing information</h2>
          {result.missingInformation.length ? (
            <ul style={{ paddingLeft: 20 }}>
              {result.missingInformation.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          ) : (
            <p>
              No missing information was flagged by the model. Verify completeness independently.
            </p>
          )}
        </section>
        <section className="card">
          <h2>Limits of this analysis</h2>
          <ul style={{ paddingLeft: 20 }}>
            {result.limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
