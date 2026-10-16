import Link from 'next/link';
import { dashboardUser } from '@/lib/dashboard';
import { Navigation, MobileNav, SignOut } from '@/components/navigation';
import { Brand } from '@/components/shared';
import { ThemeToggle } from '@/components/theme';
export const dynamic = 'force-dynamic';
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await dashboardUser();
  const admin = profile.role === 'admin';
  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand />
        <Navigation admin={admin} />
        <div className="sidebar-foot">
          <div className="notice">
            <strong>Your data. Your workspace.</strong>
            <br />
            <small>Private files and traceable insights.</small>
          </div>
          <SignOut />
        </div>
      </aside>
      <div style={{ minWidth: 0 }}>
        <header className="topbar">
          <div className="row">
            <MobileNav admin={admin} />
            <span className="muted">
              Workspace <span style={{ padding: '0 10px' }}>/</span>{' '}
              <strong style={{ color: 'var(--ink)' }}>Personal</strong>
            </span>
          </div>
          <div className="row">
            <Link href="/dashboard/wallet" className="pill desktop-only">
              Shared credit wallet
            </Link>
            <ThemeToggle />
            <span className="avatar" title={user.email}>
              {(profile.full_name || user.email || 'U').slice(0, 2).toUpperCase()}
            </span>
          </div>
        </header>
        <main className="workspace">
          {profile.deletion_requested_at && (
            <p className="notice">
              Your deletion request is pending. Open Settings and retry deletion to finish removing
              your account.
            </p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
