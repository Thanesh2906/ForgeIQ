'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import {
  LayoutDashboard,
  Layers,
  FileSearch,
  Files,
  Download,
  Wallet,
  CreditCard,
  Settings,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { Brand } from './shared';
import { browserDb } from '@/lib/supabase/browser';
const links = [
  ['Overview', '/dashboard', LayoutDashboard],
  ['AI services', '/dashboard/services', Layers],
  ['Analyses', '/dashboard/analyses', FileSearch],
  ['Uploads', '/dashboard/uploads', Files],
  ['Reports', '/dashboard/reports', Download],
  ['Credit wallet', '/dashboard/wallet', Wallet],
  ['Billing', '/dashboard/billing', CreditCard],
  ['Settings', '/dashboard/settings', Settings],
] as const;
export function Navigation({ admin = false }: { admin?: boolean }) {
  const path = usePathname();
  return (
    <nav aria-label="Workspace">
      <div className="nav-title">WORKSPACE</div>
      {links.map(([name, href, Icon], i) => (
        <div key={href}>
          {i === 5 && <div className="nav-title">ACCOUNT</div>}
          <Link className={`nav-link ${path === href ? 'active' : ''}`} href={href}>
            <Icon size={17} />
            {name}
          </Link>
        </div>
      ))}
      {admin && (
        <Link href="/admin" className="nav-link">
          <ShieldCheck size={17} />
          Administration
        </Link>
      )}
    </nav>
  );
}
export function SignOut() {
  const router = useRouter();
  return (
    <button
      className="nav-link"
      style={{ width: '100%', border: 0, background: 'transparent' }}
      onClick={async () => {
        await browserDb().auth.signOut();
        router.push('/auth/login');
        router.refresh();
      }}
    >
      <LogOut size={17} />
      Sign out
    </button>
  );
}
export function MobileNav({ admin }: { admin: boolean }) {
  return (
    <div className="mobile-menu">
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <button className="icon-btn" aria-label="Open navigation">
            <Menu size={18} />
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content">
            <div className="between">
              <Dialog.Title className="sr-only">Workspace navigation</Dialog.Title>
              <Brand />
              <Dialog.Close asChild>
                <button className="icon-btn" aria-label="Close navigation">
                  <X size={17} />
                </button>
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">
              Navigate to your services, analyses and account.
            </Dialog.Description>
            <Navigation admin={admin} />
            <SignOut />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
