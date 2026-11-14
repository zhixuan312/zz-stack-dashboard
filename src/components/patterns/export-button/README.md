# Export button

The Export button saves the rows behind a view as a CSV file, with the period and filters already applied, so the file matches the screen.

Status: beta

## Anatomy

1. **Button**: a secondary Button with the download icon and "Export" (or "Export CSV" where the format matters).
2. **Toast** (after a press): "Exported 30 days" with the file's name, "No requests to export" when the read succeeded but is empty, or "Export unavailable" when the source could not be read. Not shown with `href`: the browser reports the download.

## Composition

Button and Toast, with `toCsv` and `downloadFile` from `src/lib/csv.ts`; with `href`, Button as a link and no Toast. It sits in a masthead's actions, after the period select, or in a card's head as a small ghost button.

## Data

- `rows` is what the view shows: one plain object per row, the first row's keys as the header. Pass a function when building the rows is costly; it runs only on press. Pass `null` when the source could not be read, not an empty array. An empty array means a successful read with no rows; a missing source is unavailable.
- `href` is a server export's address, with the view's filters in it: the button becomes a download link and `rows` is not needed. Use it when the set is larger than the page shows; the route must authorize, stream and encode with `csvHeader` and `csvRow`, and start the file with `CSV_BOM`.
- A text value that starts with `=`, `+`, `-`, `@`, a tab or a carriage return is written with a leading `'`, so a spreadsheet reads it as text. Numbers are never prefixed.
- The file starts with a byte order mark, so Excel on Windows reads non-ASCII text (an accented name, a Chinese title) as UTF-8 rather than in the system code page.
- Values are written raw (ISO dates, milliseconds, cents as decimals), not formatted: a spreadsheet sorts and sums them.
- `filename` carries what was exported: `home-30d.csv`, `requests-5xx.csv`.
- `noun` names the rows in the toast, plural ("days"); `one` is the singular ("day") for a toast about a single row, so it reads "Exported 1 day".

## Variants

| Variant | Use |
|---|---|
| Secondary, `md` | The masthead action (the default) |
| Ghost, `sm` | A card's head, for one card's rows |
| Link (`href`) | A view whose rows are paged on the server |

## Sizes

As Button: `md` is 38px high (`control-md`), `sm` 32px (`control-sm`).

## States

As Button for rest, hover, pressed and focus. After a press: the positive toast, the neutral "No … to export" toast when `rows` is empty, or a critical "Export unavailable" toast with refresh advice when the source is missing. Neither empty nor unavailable saves a file.

## Behaviour

One press saves the file at once; there is no dialog. With `rows`, the file is built in the browser from the rows on screen, so it never disagrees with what the person sees. With `href`, the server builds it from the same filters, the whole filtered set rather than one page.

## Surfaces

- **Console**: in the masthead.
- **Mobile**: hidden in the masthead where space is short (`max-sm:hidden`); a phone rarely wants a file.
- **Embed**: not used. A host offers its own download, and an embed's job is one answer; link out with Open in the console instead.

## Agents

Not applicable: an export changes nothing. An agent that needs the rows reads the view's tool result, not the file.

## Accessibility

- A button named by its text ("Export"); the toast is announced through the Toaster's live region.
- Contrast as Button (secondary): `ink` on `surface` 15.6:1.

## Content

- "Export", "Export CSV". The toast: "Exported 240 requests" with `requests-5xx.csv` under it; "No requests to export" for a successful empty read. An unread source says "Export unavailable" and "The data could not be read. Refresh the page and try again." Do not suggest clearing filters where none exists.

## Do and do not

- Do export what is on screen, filters and period included.
- Do not format values in the file ("$298.43", "294ms"); write numbers and ISO dates.

## Implementation

```tsx
import { ExportButton } from '@/components/patterns/export-button';

<ExportButton rows={days} filename={`home-${period}.csv`} noun="days" />
<ExportButton href="/api/export/requests?status=5xx" filename="requests-5xx.csv" noun="requests" />
```
