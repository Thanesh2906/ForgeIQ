import { z } from 'zod';
import { identity, route, check, rate } from '@/lib/http';
import { adminDb } from '@/lib/supabase/server';
const role = z.object({
  action: z.literal('role'),
  userId: z.uuid(),
  role: z.enum(['user', 'admin']),
});
const pricing = z.object({
  action: z.literal('pricing'),
  module: z.enum(['quotation', 'ecommerce']),
  document: z.number().int().min(0).max(1000),
  image: z.number().int().min(0).max(1000),
  job: z.number().int().min(0).max(1000),
  maxFiles: z.number().int().min(1).max(10),
  enabled: z.boolean(),
});
const adjust = z.object({
  action: z.literal('credits'),
  userId: z.uuid(),
  amount: z.number().int().min(-100000).max(100000),
  reason: z.string().min(5).max(200),
  requestKey: z.uuid(),
});
const settings = z.object({
  action: z.literal('settings'),
  trialCredits: z.number().int().min(0).max(10000),
  subscriptionAllowance: z.number().int().min(0).max(100000),
});
const pack = z.object({
  action: z.literal('package'),
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().min(1).max(80),
  credits: z.number().int().min(1).max(100000),
  amountCents: z.number().int().min(50).max(10000000),
  currency: z.enum(['usd', 'myr', 'sgd', 'eur', 'gbp', 'aud', 'cad']),
  enabled: z.boolean(),
});
export const POST = route(async (req) => {
  const { user } = await identity(true);
  await rate(user.id, 'admin', 30);
  const b = z
    .discriminatedUnion('action', [pricing, adjust, settings, pack, role])
    .parse(await req.json());
  const db = adminDb();
  if (b.action === 'role')
    check(await db.rpc('set_user_role', { p_admin: user.id, p_user: b.userId, p_role: b.role }));
  else if (b.action === 'credits')
    check(
      await db.rpc('adjust_credits', {
        p_admin: user.id,
        p_user: b.userId,
        p_amount: b.amount,
        p_reason: b.reason,
        p_key: b.requestKey,
      }),
    );
  else if (b.action === 'pricing') {
    check(
      await db
        .from('pricing_rules')
        .update({
          credits_per_document: b.document,
          credits_per_image: b.image,
          credits_per_job: b.job,
          max_files: b.maxFiles,
          updated_at: new Date().toISOString(),
        })
        .eq('module_id', b.module),
    );
    check(await db.from('ai_modules').update({ enabled: b.enabled }).eq('id', b.module));
  } else if (b.action === 'settings')
    check(
      await db
        .from('platform_settings')
        .update({ trial_credits: b.trialCredits, subscription_allowance: b.subscriptionAllowance })
        .eq('id', true),
    );
  else
    check(
      await db.from('credit_packages').upsert({
        id: b.id,
        name: b.name,
        credits: b.credits,
        amount_cents: b.amountCents,
        currency: b.currency,
        enabled: b.enabled,
      }),
    );
  if (b.action !== 'credits' && b.action !== 'role')
    check(
      await db
        .from('audit_logs')
        .insert({ actor_id: user.id, action: `admin.${b.action}.updated`, metadata: b }),
    );
  return Response.json({ saved: true });
});
