import { notFound } from 'next/navigation';
import { dashboardUser } from '@/lib/dashboard';
import { check } from '@/lib/http';
import { maxFileBytes } from '@/lib/config';
import { PageHead } from '@/components/shared';
import { UploadForm } from '@/components/upload-form';
export default async function New({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  if (!['quotation', 'ecommerce'].includes(module)) notFound();
  const { db, user, profile } = await dashboardUser();
  const pricing = check(
    await db.from('pricing_rules').select('*').eq('module_id', module).single(),
  );
  const service = check(await db.from('ai_modules').select('enabled').eq('id', module).single());
  const wallet = check(await db.from('wallets').select('balance').eq('user_id', user.id).single());
  return (
    <>
      <PageHead
        eyebrow="NEW ANALYSIS"
        title={
          module === 'quotation' ? 'Supplier quotation intelligence' : 'E-commerce intelligence'
        }
        description={
          module === 'quotation'
            ? 'Compare pricing, specifications and terms with evidence you can trace.'
            : 'Understand customer complaints, defects and returns in your supplied records.'
        }
      />
      {service.enabled ? (
        <UploadForm
          module={module}
          pricing={pricing}
          balance={wallet.balance}
          consent={!!profile.consent_at}
          maxBytes={maxFileBytes()}
        />
      ) : (
        <p className="notice">This service is temporarily disabled.</p>
      )}
    </>
  );
}
