import 'server-only';
import { timingSafeEqual } from 'node:crypto';
export function cronAllowed(req: Request) {
  const secret = process.env.CRON_SECRET;
  const received = Buffer.from(req.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return Boolean(
    secret && received.length === expected.length && timingSafeEqual(received, expected),
  );
}
