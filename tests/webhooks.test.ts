import { beforeEach, describe, it, expect, vi } from 'vitest';
import Stripe from 'stripe';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ adminDb: () => ({ rpc }), sessionDb: vi.fn() }));
import { POST } from '@/app/api/webhooks/stripe/route';
const sdk = new Stripe('sk_test_fixture_only');
const secret = 'whsec_fixture_only';
function request(event: unknown, valid = true) {
  const payload = JSON.stringify(event);
  const signature = valid ? sdk.webhooks.generateTestHeaderString({ payload, secret }) : 'invalid';
  return new Request('https://forgeiq.example/api/webhooks/stripe', {
    method: 'POST',
    body: payload,
    headers: { 'stripe-signature': signature },
  });
}
beforeEach(() => {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fixture_only');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', secret);
  rpc.mockReset();
  rpc.mockResolvedValue({ data: null, error: null });
});
describe('Stripe trust boundary', () => {
  it('rejects forged signatures without touching the database', async () => {
    expect((await POST(request({ id: 'evt_fake' }, false))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects signed live-mode events', async () => {
    expect(
      (await POST(request({ id: 'evt_live', type: 'checkout.session.completed', livemode: true })))
        .status,
    ).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('does not grant credits for unpaid completed checkouts', async () => {
    const response = await POST(
      request({
        id: 'evt_pending',
        type: 'checkout.session.completed',
        livemode: false,
        data: {
          object: { id: 'cs_test', payment_status: 'unpaid', metadata: { payment_id: 'payment' } },
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('forwards verified amount, currency, session and payment identity to atomic settlement', async () => {
    const response = await POST(
      request({
        id: 'evt_paid',
        type: 'checkout.session.completed',
        livemode: false,
        data: {
          object: {
            id: 'cs_test',
            payment_status: 'paid',
            metadata: { payment_id: 'payment' },
            payment_intent: 'pi_test',
            amount_total: 1000,
            currency: 'usd',
          },
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('settle_payment', {
      p_event: 'evt_paid',
      p_payment: 'payment',
      p_session: 'cs_test',
      p_intent: 'pi_test',
      p_amount: 1000,
      p_currency: 'usd',
    });
  });
  it('returns a retryable failure when payment is not ready in the database', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'PAYMENT_NOT_READY' } });
    const response = await POST(
      request({
        id: 'evt_refund',
        type: 'charge.refunded',
        livemode: false,
        data: { object: { payment_intent: 'pi_test', amount_refunded: 500 } },
      }),
    );
    expect(response.status).toBe(500);
  });
});
