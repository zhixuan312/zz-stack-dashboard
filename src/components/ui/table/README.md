# Table

A table compares rows of records across a few columns. It fills its card edge to edge and never scrolls sideways: when it is too wide, the least important columns drop.

Status: beta

## Anatomy

The names follow the HTML elements: `TableHead` is the `thead`, `TableHeader` is a `th`. Kits such as shadcn use the reverse (`TableHeader` for the `thead`, `TableHead` for a cell), so check them when porting a table.

1. **Head band**: `surface-sunk`, a `line` rule above and below, 36px tall; head text `text-xs` medium `ink-3`, sentence case.
2. **Sort control** (optional, per column): the head text as a button with a 12px arrow; the arrow shows on hover, and stays in `accent-ink` on the sorted column.
3. **Row**: height `row-height` (52px, 38 compact); a `line` rule under each but the last.
4. **Cell**: `text-sm`; 16px horizontal padding, the card padding on the first and last column, so text aligns with the card's head.
5. **Numeric cell**: right-aligned, tabular figures.

## Variants

| Variant | Use |
|---|---|
| Static | A short, fixed list inside a card |
| Interactive rows | Each row opens a record: pointer cursor, hover fill |
| Selectable | Rows carry a checkbox; selected rows take `accent-tint` |

## Sizes

Column widths follow content, and the spare goes between the columns. The table is a grid: every column is as wide as its content, and a table with spare width puts an equal share of it in every gap between two columns, so the gaps read even whatever each column's alignment, a number beside a name as much as two names. Each row is a subgrid of the table's columns, so its border, hover and selection run across the gaps. The columns are counted from the cells of the table's first row as its own JSX writes them, the head's `TableHeader` cells when it has a head: write that row's cells there, not inside a component of your own, or the table cannot count them. `grow` on the head marks the record's name, the last column to be cut. A column whose cells can be cut (`truncate`) asks for its whole content width too, and shrinks only when the table lacks room for every column; then the cut columns give way, which is what a table with three long columns (a verification, its release, the reason it failed) needs. Every column that must show its whole value keeps its content width. A column given `width` keeps that width. A cut cell carries the full text in its `title`, or opens the record. Other text columns stay on one line. The `grow` column is at least 160px. `hideBelow` drops a column when the table itself is narrower than `sm` 512, `md` 672, `lg` 896 or `xl` 1152px, on its head and its cells alike, and marks each `data-hide-below`, so the column drawn last at that width, not the dropped one after it, takes the card's padding on its right.

## States

| State | Row |
|---|---|
| Rest | transparent |
| Hover (interactive) | `fill-hover` over `dur-hover` |
| Selected | `accent-tint`, `aria-selected` |
| Focus | 2px `accent` outline on the focused control in the row |
| Archived | text `ink-3`: quieter than a live row and still read at 4.5:1, since an archived record is content, not an inactive control |
| Disabled (a row that cannot be chosen) | `aria-disabled="true"` on the row, text `ink-disabled`; only an inactive control may drop below 4.5:1 |
| Loading | Skeleton rows of the same height (DataTable) |
| Empty | An Empty state in place of the body (DataTable) |

## Behaviour

- Sorting starts text ascending and numbers descending, then toggles; `aria-sort` says the current order. One sorted column at a time.
- The head can stick to the top of the page's scroll region (`sticky`); the table's own container clips without becoming a scroller, so sticking still works.

## Surfaces

- **Console**: columns.
- **Mobile**: drop columns with `hideBelow`; a DataTable's rows become cards under 640px of the table's own width (the same `<table>`, restyled — see its README).
- `hideBelow` reads the table's own width (a container query), not the window's, because the rail and split rows narrow a table without narrowing the window: `sm` drops a column under 512px, `md` under 672px, `lg` under 896px, `xl` under 1152px. A table never clips: if the columns still do not fit, hide one more; the audit fails a table wider than its frame.
- **Embed**: five rows, then Expand.

## Agents

An agent reads the same rows through the view's tool. A row an agent changed carries the Agent mark in its status cell until a person has seen it.

## Accessibility

- A real `table` with `caption` (visually hidden), `th scope="col"` and `aria-sort` on sortable heads.
- `clipOnPhone` on a sortable head is for a table whose head is clipped below 640px (a DataTable's cards): the label stays as the head's text for a screen reader and the sort button is not drawn, so a clipped head never holds a focus stop nobody can see.
- Head `ink-3` on `surface-sunk` 4.9:1; cells `ink` on `surface` 18.5:1 (light, cobalt).

## Content

- Head labels are nouns, sentence case, and name the unit when it is not in the cells: "Latency (ms)" or cells "612 ms".
- A missing value is an em dash, never 0.

## Do and do not

- Do right-align every numeric column, and its head.
- Do not make the table scroll sideways; drop columns.
- Do not colour whole rows by status; mark the status cell.

## Implementation

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

<Table caption="Recent requests">
  <TableHead><tr><TableHeader grow>Request</TableHeader><TableHeader hideBelow="md">Customer</TableHeader><TableHeader align="right" sort="desc" onSort={toggle}>Latency</TableHeader></tr></TableHead>
  <TableBody>
    <TableRow interactive><TableCell truncate>/v1/messages</TableCell><TableCell hideBelow="md" muted>Parallax AI</TableCell><TableCell numeric>612 ms</TableCell></TableRow>
  </TableBody>
</Table>
```
