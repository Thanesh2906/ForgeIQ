import { serve } from 'inngest/next';
import { inngest } from '@/lib/jobs/client';
import { analyzeJob } from '@/lib/jobs/functions';
export const runtime = 'nodejs';
export const maxDuration = 300;
export const { GET, POST, PUT } = serve({ client: inngest, functions: [analyzeJob] });
