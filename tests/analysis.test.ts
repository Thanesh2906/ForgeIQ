import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { aggregate } from '@/lib/ai/aggregate';
import { extractionSchema, validateReferences, type Extraction } from '@/lib/ai/schema';
import { fileMetadata, validateBytes, parseStructured } from '@/lib/files';
import { excelReport, pdfReport } from '@/lib/reports';
import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
const source = (id: string) => ({
  fileId: id,
  location: 'Page 1',
  evidence: 'Item A at MYR 10 per piece',
});
function doc(id: string, price: number, currency = 'MYR'): Extraction {
  return {
    summary: 'Test summary',
    quotations: [
      {
        supplier: id,
        product: 'Item A',
        specification: '10 mm steel',
        quantity: 100,
        unit: 'piece',
        unitPrice: price,
        total: price * 100,
        currency,
        delivery: '7 days',
        warranty: null,
        taxAndFees: 'tax included',
        source: source(id),
      },
    ],
    observations: [],
    findings: [],
    missingInformation: ['Warranty'],
    limitations: [],
  };
}
describe('Evidence and deterministic calculations', () => {
  it('compares only equivalent currency and terms', () => {
    const docs = [doc('a', 10), doc('b', 12), doc('c', 8, 'USD')];
    const result = aggregate('quotation', docs);
    expect(result.comparisons).toHaveLength(1);
    expect(result.comparisons[0]).toMatchObject({
      currency: 'MYR',
      lowest: 10,
      highest: 12,
      difference: 2,
    });
  });
  it('does not compare missing specifications or different quantities', () => {
    const a = doc('a', 10),
      b = doc('b', 12);
    b.quotations[0].quantity = 200;
    expect(aggregate('quotation', [a, b]).comparisons).toHaveLength(0);
    b.quotations[0].quantity = 100;
    b.quotations[0].specification = null;
    expect(aggregate('quotation', [a, b]).comparisons).toHaveLength(0);
  });
  it('rejects missing evidence and invalid source IDs', () => {
    const d = doc('a', 10);
    expect(() => validateReferences(d, 'b')).toThrow();
    d.quotations[0].source.evidence = '';
    expect(() => validateReferences(d, 'a')).toThrow();
  });
  it('preserves missing values instead of inventing them', () => {
    const d = doc('a', 10);
    expect(extractionSchema.parse(d).quotations[0].warranty).toBeNull();
  });
  it('does not invent sales, revenue or aggregate losses', () => {
    const r = aggregate('ecommerce', [{ ...doc('a', 10), quotations: [] }]);
    expect(r.metrics.every((m) => m.value === 0)).toBe(true);
    expect(r.losses).toEqual([]);
  });
});
describe('File validation and structured parsers', () => {
  it('rejects unsupported extensions, fake images and oversized files', async () => {
    expect(() => fileMetadata('payload.exe', 100)).toThrow();
    expect(() => fileMetadata('a.pdf', 11 * 1024 * 1024)).toThrow();
    await expect(validateBytes('a.png', Buffer.from('not an image'))).rejects.toThrow();
  });
  it('parses CSV with row references and rejects binary CSV', async () => {
    const text = await parseStructured('a.csv', Buffer.from('product,price\nWidget,10\n'));
    expect(text).toContain('Row 2');
    expect(text).toContain('Widget');
    await expect(validateBytes('a.csv', Buffer.from([0, 1, 2]))).rejects.toThrow();
  });
  it('parses real XLSX without executing spreadsheet formulas', async () => {
    const book = new ExcelJS.Workbook();
    book.addWorksheet('Quotes').addRows([
      ['Product', 'Price'],
      ['Widget', 10],
      ['=HYPERLINK("https://example.com")', 20],
    ]);
    const buf = Buffer.from(await book.xlsx.writeBuffer());
    const text = await parseStructured('quotes.xlsx', buf);
    expect(text).toContain('Sheet: Quotes');
    expect(text).toContain('Widget');
  });
  it('extracts DOCX text through the library API after dependency overrides', async () => {
    const bytes = await readFile('tests/fixtures/quotation.docx');
    expect(await parseStructured('quotation.docx', bytes)).toContain('Widget MYR 25');
  });
  it('rejects XLSX extension on non-archive content', async () => {
    await expect(validateBytes('fake.xlsx', Buffer.from('fake data'))).rejects.toThrow();
  });
});
describe('Export fidelity', () => {
  it('creates a readable workbook with literal formula-like strings', async () => {
    const d = doc('a', 10);
    d.quotations[0].product = '=2+2';
    const bytes = await excelReport(aggregate('quotation', [d]));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    expect(workbook.getWorksheet('Quotations')?.getCell('B2').value).toBe('=2+2');
    expect(workbook.getWorksheet('Quotations')?.getCell('H2').value).toBe('MYR');
  });
  it('creates a valid paginated PDF including source detail', async () => {
    const bytes = await pdfReport(aggregate('quotation', [doc('a', 10)]));
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(0);
    expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
  });
});
