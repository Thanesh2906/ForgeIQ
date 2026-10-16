export const configured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}
export function appUrl() {
  return required('APP_URL').replace(/\/$/, '');
}
export const MIME = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const;
export type ModuleId = 'quotation' | 'ecommerce';
export function maxFileBytes() {
  return Math.min(
    10 * 1024 * 1024,
    Math.max(1024, Number(process.env.MAX_FILE_BYTES) || 10 * 1024 * 1024),
  );
}
