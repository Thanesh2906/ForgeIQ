import Link from 'next/link';
import { ArrowUpRight, Check, FileSearch, Layers, ShieldCheck, ArrowRight } from 'lucide-react';
import { Brand, Services } from '@/components/shared';
import { ThemeToggle } from '@/components/theme';
export default function Home() {
  return (
    <div className="landing">
      <header className="landing-nav between">
        <Brand />
        <nav className="row desktop-nav" style={{ gap: 28 }}>
          <a href="#solutions">Solutions</a>
          <a href="#workflow">How it works</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="row">
          <ThemeToggle />
          <Link href="/auth/login" className="desktop-only">
            Sign in
          </Link>
          <Link href="/auth/signup" className="btn">
            Get started <ArrowUpRight size={15} />
          </Link>
        </div>
      </header>
      <main>
        <section className="landing-hero">
          <div>
            <div className="eyebrow row">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#277d64' }} />{' '}
              INTELLIGENCE, GROUNDED IN YOUR DATA
            </div>
            <h1>
              Better evidence.
              <br />
              Smarter business.
              <br />
              <span className="accent">One workspace.</span>
            </h1>
            <p>
              Turn supplier quotations and customer feedback into clear, traceable insights. Less
              sorting through documents. More confident decisions.
            </p>
            <div className="row" style={{ marginTop: 28 }}>
              <Link href="/auth/signup" className="btn">
                Build your advantage <ArrowRight size={16} />
              </Link>
              <a href="#workflow" className="btn secondary">
                See how it works
              </a>
            </div>
            <div className="proof row">
              <ShieldCheck size={15} /> Private files <span>·</span> Source-linked findings{' '}
              <span>·</span> Shared credits
            </div>
          </div>
          <div className="preview" aria-label="Illustrative analysis preview">
            <div className="preview-inner">
              <div className="between">
                <div className="row">
                  <FileSearch size={18} />
                  <strong>Quotation intelligence</strong>
                </div>
                <span className="pill">Illustration</span>
              </div>
              <div className="divider" />
              <div className="preview-label">FROM DOCUMENTS TO DECISIONS</div>
              <h2>Every detail. Side by side.</h2>
              <div className="grid three" style={{ gap: 8 }}>
                {['Supplier A', 'Supplier B', 'Supplier C'].map((s, i) => (
                  <div
                    key={s}
                    style={{ border: '1px solid var(--line)', borderRadius: 7, padding: 10 }}
                  >
                    <small>{s}</small>
                    <div style={{ fontWeight: 650, fontSize: 12, marginTop: 7 }}>
                      {['Price & terms', 'Specifications', 'Delivery & cover'][i]}
                    </div>
                  </div>
                ))}
              </div>
              <div className="preview-bars" aria-hidden="true">
                <span style={{ height: '70%' }} />
                <span style={{ height: '44%' }} />
                <span style={{ height: '88%' }} />
                <span style={{ height: '58%' }} />
                <span style={{ height: '72%' }} />
              </div>
              <div className="divider" />
              <div className="row">
                <span className="service-icon" style={{ margin: 0, width: 34, height: 34 }}>
                  <Check size={17} />
                </span>
                <div>
                  <strong style={{ fontSize: 12 }}>Evidence you can trace</strong>
                  <div>
                    <small>Facts, missing details and suggestions, clearly separated.</small>
                  </div>
                </div>
              </div>
            </div>
            <p style={{ fontSize: 10, margin: '15px 0 0', textAlign: 'center' }}>
              Illustrative interface. Upload your files to generate real results.
            </p>
          </div>
        </section>
        <div className="section-band">
          <section className="marketing-section" id="solutions">
            <div className="eyebrow">BUILT FOR THE WORK THAT MATTERS</div>
            <h2>
              Two focused services.
              <br />A shared intelligence layer.
            </h2>
            <Services />
          </section>
        </div>
        <section className="marketing-section" id="workflow">
          <div className="eyebrow">FROM UPLOAD TO UNDERSTANDING</div>
          <h2>A clearer way to work with your business data.</h2>
          <div className="grid three">
            {[
              {
                n: '01',
                title: 'Bring your evidence',
                body: 'Upload PDFs, images, spreadsheets or documents into your private workspace.',
                Icon: Layers,
              },
              {
                n: '02',
                title: 'Let the details surface',
                body: 'AI extracts relevant information and identifies patterns, with references to the original files.',
                Icon: FileSearch,
              },
              {
                n: '03',
                title: 'Make your next move',
                body: 'Review the findings, check missing details and share a PDF or Excel report.',
                Icon: ArrowUpRight,
              },
            ].map((s) => (
              <div key={s.n}>
                <div className="between" style={{ marginBottom: 23 }}>
                  <span className="eyebrow">{s.n}</span>
                  <s.Icon size={22} />
                </div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </section>
        <div className="section-band">
          <section id="pricing" className="marketing-section">
            <div className="grid two">
              <div>
                <div className="eyebrow">ONE WALLET. BOTH SERVICES.</div>
                <h2 style={{ fontSize: 36, lineHeight: 1.15, marginTop: 16 }}>
                  Start with trial credits.
                  <br />
                  Grow on your terms.
                </h2>
                <p>
                  See the credit cost before you run an analysis. Your balance and usage history
                  stay in one place.
                </p>
              </div>
              <div className="card">
                <span className="pill">MVP · Test billing only</span>
                <h2 style={{ marginTop: 18 }}>Transparent usage</h2>
                <ul className="stack" style={{ paddingLeft: 20, color: 'var(--muted)' }}>
                  <li>Configurable trial credits for new accounts</li>
                  <li>Charges based on files and processing jobs</li>
                  <li>Automatic credit refunds for failed jobs</li>
                  <li>PDF and Excel exports included</li>
                </ul>
                <p>
                  <small>
                    Commercial prices are not finalized. Test checkout does not collect real money.
                    Subscription billing is not enabled.
                  </small>
                </p>
                <Link href="/auth/signup" className="btn">
                  Create your workspace <ArrowUpRight size={15} />
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
      <footer className="landing-footer between">
        <Brand />
        <small>Clarity for the decisions ahead.</small>
        <div className="row">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/cookies">Cookies</Link>
        </div>
      </footer>
    </div>
  );
}
