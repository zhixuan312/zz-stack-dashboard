import type { Column } from '@/components/patterns/data-table';

/**
 * The console's table rule, applied to Meridian's columns: the first column reads left, the last right, and every
 * column between is centred, header and cell alike. One rule for every table, so no page decides it again.
 */
export function aligned<R>(columns: Column<R>[]): Column<R>[] {
  return columns.map((c, i) => ({ ...c, align: i === 0 ? 'left' : i === columns.length - 1 ? 'right' : 'center' }));
}
