import type Stripe from 'stripe';
import { stripe } from '@/lib/payments';
import { adminDb } from '@/lib/supabase/server';
import { check } from '@/lib/http';
export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature');
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET)
    return Response.json({ error: 'Missing signature or configuration' }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(
      await req.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }
  if (event.livemode)
    return Response.json({ error: 'Live payments are disabled' }, { status: 400 });
  try {
    const db = adminDb();
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const s = event.data.object;
      if (s.payment_status === 'paid' && s.metadata?.payment_id) {
        const intent =
          typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id;
        if (!intent || s.amount_total === null || !s.currency)
          throw new Error('Incomplete payment');
        check(
          await db.rpc('settle_payment', {
            p_event: event.id,
            p_payment: s.metadata.payment_id,
            p_session: s.id,
            p_intent: intent,
            p_amount: s.amount_total,
            p_currency: s.currency,
          }),
        );
      }
    } else if (
      event.type === 'checkout.session.expired' ||
      event.type === 'checkout.session.async_payment_failed'
    ) {
      const s = event.data.object;
      check(
        await db
          .from('payment_transactions')
          .update({ status: 'failed' })
          .eq('session_id', s.id)
          .eq('status', 'pending'),
      );
    } else if (event.type === 'charge.refunded') {
      const c = event.data.object;
      const intent = typeof c.payment_intent === 'string' ? c.payment_intent : c.payment_intent?.id;
      if (intent)
        check(
          await db.rpc('record_refund', {
            p_event: event.id,
            p_intent: intent,
            p_cumulative_cents: c.amount_refunded,
          }),
        );
    }
    return Response.json({ received: true });
  } catch {
    console.error('payment.webhook-retry', { eventId: event.id, type: event.type });
    return Response.json({ error: 'Webhook processing failed; retry required.' }, { status: 500 });
  }
}
