import { z } from 'zod';
import { identity, route, rate, check, HttpError } from '@/lib/http';
import { adminDb } from '@/lib/supabase/server';
import { StripeTestProvider } from '@/lib/payments';
export const POST = route(async (req) => {
  const { user } = await identity();
  await rate(user.id, 'checkout', 5, 3600);
  if (process.env.PAYMENTS_ENABLED !== 'true')
    throw new HttpError(503, 'Test payments have not been configured.');
  const { packageId, requestKey } = z
    .object({ packageId: z.string().min(1).max(50), requestKey: z.uuid() })
    .parse(await req.json());
  const db = adminDb();
  let payment = check(
    await db
      .from('payment_transactions')
      .select('*')
      .eq('id', requestKey)
      .eq('user_id', user.id)
      .maybeSingle(),
  );
  if (!payment) {
    const pack = check(
      await db.from('credit_packages').select('*').eq('id', packageId).eq('enabled', true).single(),
    );
    const inserted = await db
      .from('payment_transactions')
      .insert({
        id: requestKey,
        user_id: user.id,
        package_id: pack.id,
        credits: pack.credits,
        amount_cents: pack.amount_cents,
        currency: pack.currency,
      })
      .select('*')
      .single();
    if (inserted.error) {
      payment = check(
        await db
          .from('payment_transactions')
          .select('*')
          .eq('id', requestKey)
          .eq('user_id', user.id)
          .single(),
      );
    } else payment = inserted.data;
  }
  if (payment.status !== 'pending') throw new HttpError(409, 'This payment is already finalized.');
  const checkout = await new StripeTestProvider().create({
    paymentId: payment.id,
    userId: user.id,
    name: 'ForgeIQ test credits',
    amount: payment.amount_cents,
    currency: payment.currency,
  });
  check(
    await db
      .from('payment_transactions')
      .update({ session_id: checkout.id })
      .eq('id', payment.id)
      .eq('user_id', user.id),
  );
  return Response.json({ url: checkout.url });
});
