import { z } from 'zod';
const reference = z.object({ fileId: z.string(), location: z.string(), evidence: z.string() });
const finding = z.object({
  title: z.string(),
  detail: z.string(),
  kind: z.enum(['fact', 'interpretation', 'recommendation']),
  sources: z.array(reference),
});
const quote = z.object({
  supplier: z.string().nullable(),
  product: z.string(),
  specification: z.string().nullable(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  unitPrice: z.number().nullable(),
  total: z.number().nullable(),
  currency: z.string().nullable(),
  delivery: z.string().nullable(),
  warranty: z.string().nullable(),
  taxAndFees: z.string().nullable(),
  source: reference,
});
const observation = z.object({
  product: z.string().nullable(),
  category: z.string(),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'unknown']),
  recordType: z.enum(['review', 'return', 'complaint', 'sale', 'other']),
  count: z.number().int().nonnegative(),
  financialLoss: z.number().nonnegative().nullable(),
  currency: z.string().nullable(),
  lossBasis: z.string().nullable(),
  source: reference,
});
export const extractionSchema = z.object({
  summary: z.string(),
  quotations: z.array(quote),
  observations: z.array(observation),
  findings: z.array(finding),
  missingInformation: z.array(z.string()),
  limitations: z.array(z.string()),
});
export type Extraction = z.infer<typeof extractionSchema>;
export type Reference = z.infer<typeof reference>;
export type Result = {
  version: 1;
  module: 'quotation' | 'ecommerce';
  summary: string;
  documents: Extraction[];
  findings: Extraction['findings'];
  missingInformation: string[];
  limitations: string[];
  comparisons: {
    product: string;
    currency: string;
    unit: string;
    lowest: number;
    highest: number;
    difference: number;
    sources: Reference[];
  }[];
  metrics: { label: string; value: number; kind: 'calculation'; basis: string }[];
  losses: { currency: string; amount: number; basis: string }[];
};
export function validateReferences(value: Extraction, fileId: string) {
  const refs = [
    ...value.quotations.map((x) => x.source),
    ...value.observations.map((x) => x.source),
    ...value.findings.flatMap((x) => x.sources),
  ];
  if (refs.some((s) => s.fileId !== fileId || !s.location.trim() || !s.evidence.trim()))
    throw new Error('Invalid source references');
  if (value.findings.some((f) => f.kind === 'fact' && !f.sources.length))
    throw new Error('Facts require evidence');
  if (
    value.quotations.some((q) =>
      [q.quantity, q.unitPrice, q.total].some((n) => n !== null && (!Number.isFinite(n) || n < 0)),
    )
  )
    throw new Error('Invalid quotation number');
  return value;
}
