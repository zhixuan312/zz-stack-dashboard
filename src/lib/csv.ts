/**
 * Rows of plain values as RFC 4180 CSV: quotes only where a value needs them. A text value a spreadsheet would read as
 * a formula (it starts with `=`, `+`, `-`, `@`, a tab or a carriage return) is written with a leading `'`, so it opens
 * as text. A number is never prefixed: `-5` is a number, not an attack.
 */
export type CsvRow = Record<string, string | number | boolean | null | undefined>;

const cell = (v: CsvRow[string]) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The header line for `keys`, without a line break. */
export const csvHeader = (keys: string[]): string => keys.map(cell).join(',');

/** One row's line, its values in the order of `keys`, without a line break. */
export const csvRow = (keys: string[], row: CsvRow): string => keys.map((k) => cell(row[k])).join(',');

export function toCsv(rows: CsvRow[]): string {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  return [csvHeader(keys), ...rows.map((r) => csvRow(keys, r))].join('\r\n') + '\r\n';
}

/** Hand the browser a file to save. Client only. */
export function downloadFile(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
