# Records

The arrangement of a page that lists records: an optional row of summary tiles over a table with its toolbar.

Status: beta

## Anatomy

1. **Root**: one `Stack`, marked `data-template="records"`.
2. **Summary row** (optional, `summary`): a `Row split="tiles"` whose direct children are the items of `summary` (an array, one node, or the children of a fragment); two to four tiles, columns chosen by their count. With `empty` (there are no records at all, not none that match a filter) it is not drawn: the table's empty state says so once, and a row of zeros above it would draw figures as if there were records.
3. **Records** (`children`): a Data table with its Filter bar as `toolbar`.
4. **Skeleton** (`RecordsSkeleton({ tiles?, rows?, filters? })`): the arrangement while its data is on its way, `tiles` summary tiles (none when not given) over a table skeleton of `rows` rows with or without its filter row. It adds no element of its own: it returns a fragment, so it sits inside a page's loading frame where `Records` will sit.

## Composition

Stack gap between the summary row and the records, from `--stack-gap`. The template draws no card of its own: the tiles and the table are the cards. It imports no data, view, system or config module and keeps no state; the page owns the rows, the filters and the address.

## States

Each of the seven states has one disposition: covered by a named specimen in the preview, or inapplicable with the reason. `tests/atlas-template-contracts.test.tsx` holds this table and the preview to each other.

| State | Disposition |
|---|---|
| Normal | Covered: the "With a summary" and "Without a summary" specimens. |
| Loading | Covered: the "Loading" specimen, which is `RecordsSkeleton`: the tiles and the table's shape with no table. |
| Empty | Covered: the "Empty" specimen, given a summary and `empty`: no tiles, only the table's first-run state. |
| Filtered-empty | Covered: the "Filtered-empty" specimen. |
| Error | Covered: the "Error" specimen, the table's own error state with Retry inside the arrangement. |
| Partial | Covered: the "Partial" specimen, a summary in which a figure that could not be worked out is the word Unavailable with a line saying why, over records that did arrive. |
| Read-only | Covered: the "Read-only" specimen, the table with nothing that creates, adds or invites. A read-only page offers no control it withholds and says nothing about who holds it: no line names a role beside what it may do. |

## Surfaces

- **Console**: tiles in one row from the width their count needs, over the table.
- **Mobile**: tiles stack in one column; the table keeps its own phone layout.
- **Embed**: not applicable until a page uses it in an embed.

## Agents

Not applicable: the template presents what its children show. Agent marks and proposals belong to the tiles and the table inside it.

## Accessibility

- The template adds no landmark or role; the table is named by its caption and each tile by its label.
- Reading order is the visual order: summary, then records.

## Implementation

While the data is on its way, a route's `loading.tsx` and its Suspense fallback draw `<RecordsSkeleton tiles={3} rows={8} />` inside `LoadingPage` or `Busy`.

`summary` may also be a fragment, which counts as its children; the row sizes its columns by them:

```tsx
<Records summary={[<MetricTile key="a" label="Customers" value={42} />, <MetricTile key="b" label="Revenue" value={1200} format="cost" />]}>
  <DataTable caption="Customers" noun="customers" rows={rows} columns={columns} rowKey={(r) => r.id} toolbar={<FilterBar … />} />
</Records>
```
