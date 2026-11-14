# Pagination

Pagination moves through a long list a page at a time and says where you are: "21–40 of 240 requests". Every list that can pass ten rows pages, which is what keeps a card its content's height and the page to one scroller.

Status: beta

## Anatomy

1. **Range**: "21–40 of 240 requests"; the range in `ink` medium, the rest `ink-2`, tabular figures.
2. **Rows per page** (optional): a ghost trigger, "20 per page", opening a Menu of sizes. It is drawn only when there are two sizes or more to choose from.
3. **Previous** and **Next**: small ghost icon buttons.
4. **Pages**: numbers, with an ellipsis for gaps; the current page is a raised chip.

## Variants

| Variant | Shows |
|---|---|
| Default | Range, pages, previous and next |
| With size | Adds rows per page (10, 20, 50) |

## Sizes

Controls at `control-sm` 32px; page buttons at least 32px wide with 6px padding, 2px apart. Pages shown: the first, the last, and one either side of the current one. Within the first or last three pages, show the first or last four respectively; seven or fewer pages are all shown.

## States

| State | Page button |
|---|---|
| Rest | `ink-2` |
| Hover | fill `fill-hover`, `ink` |
| Current | `surface` fill, `line-strong` ring, `shadow-control`, `ink` semibold, `aria-current="page"` |
| Focus | 2px `accent` outline |
| Previous on page 1, Next on the last page | Disabled |

## Behaviour

- Changing page keeps the scroll position of the page's header.
- Changing rows per page returns to page 1.
- In a Data table, the page lives in the URL (`?page=2`), so a page of results is linkable. The rows per page is the table's own, alongside its sort: it is a way of reading, not part of the view, and no page has to carry it in the address.
- A list that is not a data table (a roster in a settings card, a short list inside a card) pages with `usePaged(rows, { pageSize, resetKey })`. `resetKey` is whatever narrows the rows (the search, a filter): narrowing lands on page 1 without an effect, and the page is clamped when read, so a refetch with fewer rows never leaves an empty page. The pager shows only when `paged` is true.

## Surfaces

- **Console**: as specified.
- **Mobile**: the pager reads its own width, not the screen's: under 32rem (a phone, or a card in a narrow column) only "Page 2 of 12" and the two arrows; under 44rem the size menu hides.
- **Embed**: inline embeds show five rows and Expand instead of pagination.

## Agents

An agent reads any page by its address; it never pages through the interface.

## Accessibility

- `nav` labelled "Pagination"; page buttons named "Page 3"; the arrows "Previous page" and "Next page".
- Range `ink-2` on `surface` 7.1:1 (light, cobalt).

## Content

- Name the rows: "of 240 requests", not "of 240 results".

## Do and do not

- Do keep the page size the same across a session.
- Do not use infinite scroll in a card; it breaks the one-scroller rule.

## Implementation

```tsx
import { Pagination } from '@/components/ui/pagination';

<Pagination page={page} pageSize={20} total={240} noun="requests" onPageChange={setPage} pageSizes={[10, 20, 50]} onPageSizeChange={setSize} />
```

`pageList(page, count)` returns the numbers and gaps, for a custom layout.

```tsx
const { rows: page, paged, pagination } = usePaged(members, { pageSize: 10, resetKey: query });
<ul>{page.map((m) => <li key={m.id}>{m.name}</li>)}</ul>
{paged ? <Pagination {...pagination} noun="members" pageSizes={[10, 20, 50]} /> : null}
```
