import { dispatch } from '@/lib/jobs/dispatch';
import { cronAllowed } from '@/lib/cron';
export const maxDuration = 60;
export async function GET(req: Request) {
  if (!cronAllowed(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return Response.json(await dispatch());
}
