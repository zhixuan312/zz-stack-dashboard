'use client';

import { Download } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { downloadFile, toCsv, type CsvRow } from '@/lib/csv';

/**
 * Save what the page shows as a CSV file: the rows behind the view, with the filters and period already applied, so
 * the file matches the screen. A toast says how many rows went into which file.
 */
export function ExportButton({
  rows,
  filename,
  noun,
  label = 'Export',
  ...rest
}: {
  /** The rows behind the view, one plain object each; the first row's keys are the header. */
  rows: CsvRow[] | (() => CsvRow[]);
  /** The file's name, with the period or filter in it: "requests-5xx.csv". */
  filename: string;
  /** What a row is, plural, for the toast: "days", "requests". */
  noun: string;
  label?: string;
} & Omit<ButtonProps, 'onClick' | 'children'>) {
  const save = () => {
    const data = typeof rows === 'function' ? rows() : rows;
    if (!data.length) return toast({ tone: 'neutral', title: `No ${noun} to export`, description: 'Clear a filter to include more.' });
    downloadFile(filename, toCsv(data));
    toast({ tone: 'positive', title: `Exported ${data.length.toLocaleString('en-US')} ${noun}`, description: filename });
  };
  return (
    <Button icon={<Download />} onClick={save} {...rest}>
      {label}
    </Button>
  );
}
