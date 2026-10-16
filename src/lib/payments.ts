import 'server-only';
import Stripe from 'stripe';
import { appUrl, required } from './config';
export interface CheckoutProvider {
  create(input: {
    paymentId: string;
    userId: string;
    name: string;
    amount: number;
    currency: string;
  }): Promise<{ id: string; url: string }>;
}
export function stripe() {
  const key = required('STRIPE_SECRET_KEY');
  if (!key.startsWith('sk_test_')) throw new Error('Only Stripe test credentials are supported.');
  return new Stripe(key);
}
export class StripeTestProvider implements CheckoutProvider {
  async create(input: {
    paymentId: string;
    userId: string;
    name: string;
    amount: number;
    currency: string;
  }) {
    if (process.env.PAYMENTS_ENABLED !== 'true') throw new Error('Test checkout is disabled.');
    const session = await stripe().checkout.sessions.create(
      {
        mode: 'payment',
        client_reference_id: input.userId,
        metadata: { payment_id: input.paymentId },
        payment_intent_data: { metadata: { payment_id: input.paymentId } },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: input.currency,
              unit_amount: input.amount,
              product_data: { name: input.name },
            },
          },
        ],
        success_url: `${appUrl()}/dashboard/billing?checkout=returned`,
        cancel_url: `${appUrl()}/dashboard/billing?checkout=cancelled`,
      },
      { idempotencyKey: `checkout-${input.paymentId}` },
    );
    if (!session.url) throw new Error('Checkout unavailable');
    return { id: session.id, url: session.url };
  }
}
