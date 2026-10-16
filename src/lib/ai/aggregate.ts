import type { Extraction, Result } from './schema';
// Never combine currencies, unlike units, or ambiguous specifications.
export function aggregate(module: 'quotation' | 'ecommerce', documents: Extraction[]): Result {
  const comparisons: Result['comparisons'] = [];
  if (module === 'quotation') {
    const groups = new Map<string, Extraction['quotations']>();
    for (const q of documents.flatMap((d) => d.quotations)) {
      if (
        q.unitPrice === null ||
        !q.currency ||
        !q.unit ||
        !q.specification ||
        q.quantity === null ||
        !q.taxAndFees ||
        !q.delivery
      )
        continue;
      const key = JSON.stringify([
        q.product.toLowerCase().trim(),
        q.specification.toLowerCase().trim(),
        q.currency.toUpperCase(),
        q.unit.toLowerCase().trim(),
        q.quantity,
        q.taxAndFees.toLowerCase().trim(),
        q.delivery.toLowerCase().trim(),
      ]);
      groups.set(key, [...(groups.get(key) || []), q]);
    }
    for (const rows of groups.values()) {
      if (rows.length < 2 || new Set(rows.map((r) => r.source.fileId)).size < 2) continue;
      const prices = rows.map((r) => r.unitPrice!);
      const lowest = Math.min(...prices),
        highest = Math.max(...prices);
      comparisons.push({
        product: rows[0].product,
        currency: rows[0].currency!,
        unit: rows[0].unit!,
        lowest,
        highest,
        difference: Math.round((highest - lowest) * 1000000) / 1000000,
        sources: rows.map((r) => r.source),
      });
    }
  }
  const observations = documents.flatMap((d) => d.observations);
  const unique = new Map(
    observations.map((o) => [
      JSON.stringify([o.source.fileId, o.source.location, o.recordType, o.product, o.category]),
      o,
    ]),
  );
  const rows = [...unique.values()];
  const metrics: Result['metrics'] =
    module === 'ecommerce'
      ? ['review', 'return', 'complaint'].map((type) => ({
          label: `${type[0].toUpperCase() + type.slice(1)} records`,
          value: rows.filter((x) => x.recordType === type).reduce((a, b) => a + b.count, 0),
          kind: 'calculation',
          basis:
            'Sum of extracted counts in supplied records only; categories may overlap. Not a whole-business statistic.',
        }))
      : [];
  const losses: Result['losses'] = [];
  // AI-extracted losses are not summed into a financial claim automatically.
  return {
    version: 1,
    module,
    summary: documents.map((d) => d.summary).join('\n\n'),
    documents,
    findings: documents.flatMap((d) => d.findings),
    missingInformation: [...new Set(documents.flatMap((d) => d.missingInformation))],
    limitations: [
      ...new Set([
        ...documents.flatMap((d) => d.limitations),
        'AI-extracted facts require review against the original documents.',
        'Comparisons require matching product, specification, unit, quantity, currency, tax/fee terms and delivery. No currency conversion is applied.',
        ...(module === 'ecommerce'
          ? [
              'Counts describe extracted input records and may overlap across categories. Financial loss candidates are shown with source evidence; no aggregate loss or revenue is asserted.',
            ]
          : []),
      ]),
    ],
    comparisons,
    metrics,
    losses,
  };
}
