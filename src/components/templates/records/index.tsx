import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Row, Stack } from '../../base/shell/index';
import { TableSkeleton, TilesSkeleton } from '../../patterns/page-loading/index';

/**
 * The arrangement of a page that lists records: an optional row of summary tiles over the records themselves
 * (a Data table with its Filter bar). It keeps no state and reads no data; the page supplies both. Each item of
 * `summary` is a direct child of the tiles row, which sizes its columns by counting them; a fragment counts as its children.
 */
export function Records({ summary, children }: { /** The summary tiles: one node, a fragment or an array, whose items become the row's direct children. */ summary?: ReactNode; children: ReactNode }) {
  /* A fragment is one child to React, but the row counts tiles: open it one level. */
  const tiles = Children.toArray(isValidElement(summary) && summary.type === Fragment ? (summary as ReactElement<{ children?: ReactNode }>).props.children : summary);
  return (
    <Stack data-template="records">
      {tiles.length ? <Row split="tiles">{tiles}</Row> : null}
      {children}
    </Stack>
  );
}

/**
 * The arrangement while its records are on their way: `tiles` summary tiles (none when not given) over a table skeleton of
 * `rows` rows, with or without its filter row. It adds no element of its own, so a page puts it where `Records` goes, inside
 * the page's loading frame, and the frame's one stack spaces the pieces exactly as the arrangement will be spaced.
 */
export function RecordsSkeleton({ tiles = 0, rows = 8, filters = true }: { tiles?: number; rows?: number; filters?: boolean }) {
  return (
    <>
      {tiles > 0 ? <TilesSkeleton count={tiles} /> : null}
      <TableSkeleton rows={rows} filters={filters} />
    </>
  );
}
