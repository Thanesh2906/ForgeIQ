import Link from 'next/link';
import { ArrowUpRight, Files, ScanLine, ShoppingBag } from 'lucide-react';
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="ForgeIQ home">
      <span className="brand-mark">F</span>Forge
      <span style={{ color: 'var(--brand)', marginLeft: -9 }}>IQ</span>
    </Link>
  );
}
export function PageHead({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-head between">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty">
      <Files size={32} />
      <h3>{title}</h3>
      <p>{description}</p>
      <Link href="/dashboard/services" className="btn secondary">
        Explore services <ArrowUpRight size={15} />
      </Link>
    </div>
  );
}
export function Services({ disabled = [] }: { disabled?: string[] }) {
  return (
    <div className="grid two">
      {[
        {
          id: 'quotation',
          name: 'Supplier Quotation',
          tag: 'PROCUREMENT INTELLIGENCE',
          description:
            'Compare supplier pricing, specifications and terms. See what is missing before you commit.',
          Icon: ScanLine,
          types: 'Quotations · Specifications · Supplier proposals',
        },
        {
          id: 'ecommerce',
          name: 'E-commerce',
          tag: 'CUSTOMER & PRODUCT INTELLIGENCE',
          description:
            'Find recurring complaints, product defects and return patterns in your customer evidence.',
          Icon: ShoppingBag,
          types: 'Reviews · Returns · Sales records',
        },
      ].map((s, i) => (
        <div className={`card service-card ${i ? 'blue' : ''}`} key={s.id}>
          <div className="between">
            <div className="service-icon">
              <s.Icon size={22} />
            </div>
            <span className="pill">{disabled.includes(s.id) ? 'Unavailable' : 'Available'}</span>
          </div>
          <div className="eyebrow">{s.tag}</div>
          <h2 style={{ margin: '7px 0 9px' }}>{s.name}</h2>
          <p>{s.description}</p>
          <small>{s.types}</small>
          <div className="divider" />
          {disabled.includes(s.id) ? (
            <small>Temporarily disabled by administrator.</small>
          ) : (
            <Link href={`/dashboard/new/${s.id}`} className="link row">
              Start an analysis <ArrowUpRight size={16} />
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
export function Status({ status }: { status: string }) {
  return <span className={`pill ${status}`}>{status.replaceAll('_', ' ')}</span>;
}
export function DateText({ value }: { value: string }) {
  return (
    <>
      {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(
        new Date(value),
      )}
    </>
  );
}
