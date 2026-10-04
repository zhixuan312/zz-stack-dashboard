/** Rows of plain values as RFC 4180 CSV: a header from the first row's keys, quotes only where a value needs them. */
export type CsvRow = Record<string, string | number | boolean | null | undefined>;

const cell = (v: CsvRow[string]) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: CsvRow[]): string {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  return [keys.map(cell).join(','), ...rows.map((r) => keys.map((k) => cell(r[k])).join(','))].join('\r\n') + '\r\n';
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
