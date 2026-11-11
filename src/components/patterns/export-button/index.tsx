'use client';

import { Download } from 'lucide-react';
import { Button, type ButtonProps } from '../../ui/button/index';
import { toast } from '../../ui/toast/index';
import { downloadFile, toCsv, type CsvRow } from '../../../lib/csv';
import { plural } from '../../../lib/format';

/**
 * Save what the page shows as a CSV file: the rows behind the view, with the filters and period already applied, so
 * the file matches the screen. A toast says how many rows went into which file. With `href`, the file comes from the
 * server instead: a link to an export that streams the whole filtered set, which a page of rows cannot hold.
 */
export function ExportButton({
  rows,
  href,
  filename,
  noun,
  one,
  label = 'Export',
  ...rest
}: {
  /** The rows behind the view, one plain object each; null when unread, [] only after a successful empty read. */
  rows?: CsvRow[] | null | (() => CsvRow[] | null);
  /** A server export's address: the button is a download link to it, and `rows` is not needed. */
  href?: string;
  /** The file's name, with the period or filter in it: "requests-5xx.csv". */
  filename: string;
  /** What a row is, plural, for the toast: "days", "requests". */
  noun: string;
  /** What one row is, for a toast about a single row: "day", "request". Without it one row reads with `noun`. */
  one?: string;
  label?: string;
} & Omit<ButtonProps, 'onClick' | 'children'>) {
  if (href) {
    return (
      <Button asChild {...rest}>
        <a href={href} download={filename}>
          <Download />
          {label}
        </a>
      </Button>
    );
  }
  const save = () => {
    const data = typeof rows === 'function' ? rows() : rows;
    if (data == null) return toast({ tone: 'critical', title: 'Export unavailable', description: 'The data could not be read. Refresh the page and try again.' });
    if (!data.length) return toast({ tone: 'neutral', title: `No ${noun} to export` });
    downloadFile(filename, toCsv(data));
    toast({ tone: 'positive', title: `Exported ${data.length.toLocaleString('en-US')} ${plural(data.length, one ?? noun, noun)}`, description: filename });
  };
  return (
    <Button icon={<Download />} onClick={save} {...rest}>
      {label}
    </Button>
  );
}
