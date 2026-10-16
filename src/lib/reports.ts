import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { Result } from './ai/schema';
export function reportRows(result: Result): string[][] {
  const rows: string[][] = [
    ['ForgeIQ analysis', result.module],
    ['Generated', new Date().toISOString()],
    ['Summary — AI interpretation', result.summary],
  ];
  for (const d of result.documents) {
    for (const q of d.quotations) rows.push(['Extracted quotation', JSON.stringify(q)]);
    for (const o of d.observations) rows.push(['Extracted observation', JSON.stringify(o)]);
  }
  for (const x of result.comparisons)
    rows.push([
      'Calculation — unit price spread',
      `${x.product} | ${x.currency} / ${x.unit} | min ${x.lowest} | max ${x.highest} | difference ${x.difference}`,
      JSON.stringify(x.sources),
    ]);
  for (const m of result.metrics) rows.push(['Calculation', m.label, String(m.value), m.basis]);
  for (const f of result.findings)
    rows.push([f.kind, f.title, f.detail, JSON.stringify(f.sources)]);
  for (const m of result.missingInformation) rows.push(['Missing information', m]);
  for (const l of result.limitations) rows.push(['Limitation', l]);
  return rows;
}
export async function excelReport(result: Result) {
  const book = new ExcelJS.Workbook();
  book.creator = 'ForgeIQ';
  const add = (name: string, rows: unknown[][]) => {
    const sheet = book.addWorksheet(name);
    rows.forEach((r) =>
      sheet.addRow(r.map((v) => (typeof v === 'string' ? v.slice(0, 32700) : v))),
    );
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF134E4A' } };
    sheet.columns.forEach((c) => {
      c.width = 28;
    });
    sheet.eachRow((r) => {
      r.alignment = { vertical: 'top', wrapText: true };
    });
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: { row: rows.length, column: rows[0]?.length || 1 } };
  };
  add('Summary', [['Type', 'Content', 'Value', 'Basis / sources'], ...reportRows(result)]);
  add('Quotations', [
    [
      'Supplier',
      'Product',
      'Specification',
      'Quantity',
      'Unit',
      'Unit price',
      'Total',
      'Currency',
      'Delivery',
      'Warranty',
      'Tax and fees',
      'File',
      'Location',
      'Evidence',
    ],
    ...result.documents.flatMap((d) =>
      d.quotations.map((q) => [
        q.supplier,
        q.product,
        q.specification,
        q.quantity,
        q.unit,
        q.unitPrice,
        q.total,
        q.currency,
        q.delivery,
        q.warranty,
        q.taxAndFees,
        q.source.fileId,
        q.source.location,
        q.source.evidence,
      ]),
    ),
  ]);
  add('Customer evidence', [
    [
      'Product',
      'Category',
      'Sentiment',
      'Record type',
      'Count',
      'Explicit loss candidate',
      'Currency',
      'Loss basis',
      'File',
      'Location',
      'Evidence',
    ],
    ...result.documents.flatMap((d) =>
      d.observations.map((o) => [
        o.product,
        o.category,
        o.sentiment,
        o.recordType,
        o.count,
        o.financialLoss,
        o.currency,
        o.lossBasis,
        o.source.fileId,
        o.source.location,
        o.source.evidence,
      ]),
    ),
  ]);
  return Buffer.from(await book.xlsx.writeBuffer());
}
export async function pdfReport(result: Result) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(
    await readFile(join(process.cwd(), 'assets/fonts/DejaVuSans.ttf')),
    { subset: true },
  );
  const supported = new Set(font.getCharacterSet());
  let page = pdf.addPage([595, 842]),
    y = 790;
  let pageNumber = 1;
  const next = () => {
    page.drawText(`ForgeIQ • ${pageNumber}`, {
      x: 42,
      y: 25,
      size: 8,
      font,
      color: rgb(0.4, 0.45, 0.45),
    });
    page = pdf.addPage([595, 842]);
    pageNumber++;
    y = 790;
  };
  const line = (text: string, size = 9) => {
    if (y < 55) next();
    page.drawText(text, { x: 42, y, size, font, color: rgb(0.08, 0.17, 0.17) });
    y -= size + 6;
  };
  const paragraph = (raw: string, size = 9) => {
    const text = Array.from(raw)
      .map((c) =>
        c === '\n'
          ? '\n'
          : supported.has(c.codePointAt(0)!)
            ? c
            : `[U+${c.codePointAt(0)!.toString(16).toUpperCase()}]`,
      )
      .join('');
    for (const p of text.split('\n')) {
      let current = '';
      for (const char of p) {
        if (font.widthOfTextAtSize(current + char, size) > 510) {
          line(current, size);
          current = '';
        }
        current += char;
      }
      line(current, size);
    }
  };
  paragraph('FORGEIQ / BUSINESS INTELLIGENCE', 16);
  paragraph('Evidence-led analysis report', 12);
  paragraph(
    'AI-extracted facts require source review. Unsupported font glyphs use Unicode code points.',
  );
  y -= 12;
  for (const row of reportRows(result)) {
    paragraph(row[0].toUpperCase(), 10);
    for (const value of row.slice(1)) paragraph(value);
    y -= 10;
  }
  page.drawText(`ForgeIQ • ${pageNumber}`, { x: 42, y: 25, size: 8, font });
  return Buffer.from(await pdf.save());
}
