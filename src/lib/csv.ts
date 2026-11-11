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
  // Every key any row carries, not only the first row's: a column a later row is the only one to hold would otherwise be
  // dropped from the file with nothing said — the export would be missing a value its source had.
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return [csvHeader(keys), ...rows.map((r) => csvRow(keys, r))].join('\r\n') + '\r\n';
}

/**
 * A byte order mark for the start of a CSV file. Excel on Windows opened by double-click reads a file without one in the
 * system code page, so an accented name or a Chinese title arrives as mojibake; the Blob's charset is lost on disk.
 */
export const CSV_BOM = '\uFEFF';

/** Hand the browser a file to save. Client only. A CSV starts with `CSV_BOM`, so the rows `toCsv` built stay without one. */
export function downloadFile(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([type.startsWith('text/csv') ? CSV_BOM + text : text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
