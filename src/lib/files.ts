import 'server-only';
import { fileTypeFromBuffer } from 'file-type';
import { fromBuffer } from 'yauzl';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import mammoth from 'mammoth';
import { MIME, maxFileBytes } from './config';
export const MAX_TEXT = 60000;
export function fileMetadata(name: string, size: number) {
  const ext = name.split('.').pop()?.toLowerCase() as keyof typeof MIME;
  if (!MIME[ext]) throw new Error('Unsupported file extension.');
  if (!size || size > maxFileBytes()) throw new Error('File exceeds the size limit or is empty.');
  if (name.length > 180 || /[\x00-\x1f/\\]/.test(name)) throw new Error('Invalid filename.');
  return { ext, mime: MIME[ext] };
}
// Stream every zip member with strict actual decompression limits before invoking parsers.
export async function inspectArchive(buffer: Buffer) {
  return new Promise<string[]>((resolve, reject) => {
    fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (err, zip) => {
      if (err || !zip) {
        reject(err || new Error('Invalid archive'));
        return;
      }
      let total = 0;
      const names: string[] = [];
      let done = false;
      const fail = (e: Error) => {
        if (done) return;
        done = true;
        zip.close();
        reject(e);
      };
      zip.on('error', fail);
      zip.on('entry', (entry) => {
        names.push(entry.fileName);
        if (
          names.length > 500 ||
          entry.uncompressedSize > 20 * 1024 * 1024 ||
          entry.isEncrypted() ||
          entry.fileName.includes('../')
        ) {
          fail(new Error('Unsafe or oversized archive'));
          return;
        }
        if (/\/$/.test(entry.fileName)) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (err, stream) => {
          if (err || !stream) {
            fail(err || new Error('Invalid archive entry'));
            return;
          }
          stream.on('data', (data: Buffer) => {
            total += data.length;
            if (total > 30 * 1024 * 1024) {
              stream.destroy();
              fail(new Error('Expanded document is too large'));
            }
          });
          stream.on('error', fail);
          stream.on('end', () => {
            if (!done) zip.readEntry();
          });
        });
      });
      zip.on('end', () => {
        if (!done) {
          done = true;
          resolve(names);
        }
      });
      zip.readEntry();
    });
  });
}
export async function validateBytes(name: string, buffer: Buffer, expectedSize?: number) {
  const meta = fileMetadata(name, buffer.length);
  if (expectedSize !== undefined && buffer.length !== expectedSize)
    throw new Error('File size mismatch');
  if (meta.ext === 'csv') {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    if (text.includes('\0')) throw new Error('Invalid CSV');
    const rows = parse(text, {
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      max_record_size: 100000,
    });
    if (rows.length > 5000 || rows.some((r: string[]) => r.length > 100))
      throw new Error('CSV limit: 5,000 rows and 100 columns.');
    if (!rows.length) throw new Error('Empty CSV');
    return meta;
  }
  const type = await fileTypeFromBuffer(buffer);
  if (meta.ext === 'docx' || meta.ext === 'xlsx') {
    const names = await inspectArchive(buffer);
    const required = meta.ext === 'docx' ? 'word/document.xml' : 'xl/workbook.xml';
    if (
      !names.includes(required) ||
      names.some((n) => /vbaProject|externalLinks|embeddings|activeX/i.test(n))
    )
      throw new Error('Invalid Office document or unsupported embedded content');
  } else if (type?.mime !== meta.mime) throw new Error('File content does not match its extension');
  return meta;
}
export async function parseStructured(name: string, buffer: Buffer) {
  const { ext } = await validateBytes(name, buffer);
  if (ext === 'csv') {
    const rows: string[][] = parse(buffer.toString('utf8'), {
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      max_record_size: 100000,
    });
    return limit(rows.map((r, i) => `Row ${i + 1}: ${JSON.stringify(r)}`).join('\n'));
  }
  if (ext === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const parts: string[] = [];
    let cells = 0;
    for (const sheet of workbook.worksheets) {
      if (sheet.rowCount > 5000 || sheet.columnCount > 100)
        throw new Error('Worksheet limit exceeded');
      parts.push(`Sheet: ${sheet.name}`);
      sheet.eachRow((row, n) => {
        cells += row.cellCount;
        if (cells > 30000) throw new Error('Workbook cell limit exceeded');
        parts.push(`Row ${n}: ${JSON.stringify(row.values)}`);
      });
    }
    return limit(parts.join('\n'));
  }
  if (ext === 'docx') {
    const text = (await mammoth.extractRawText({ buffer })).value;
    return limit(text);
  }
  return null;
}
function limit(text: string) {
  if (text.length > MAX_TEXT)
    throw new Error('Document text exceeds 60,000 characters. Split the document and retry.');
  if (!text.trim()) throw new Error('Document has no readable text');
  return text;
}
