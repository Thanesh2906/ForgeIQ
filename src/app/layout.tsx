import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/theme';
export const metadata: Metadata = {
  title: { default: 'ForgeIQ — Evidence into advantage', template: '%s | ForgeIQ' },
  description:
    'Supplier quotation and e-commerce intelligence in one secure workspace. Turn business documents into evidence-led decisions.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
