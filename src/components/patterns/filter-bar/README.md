# Filter bar

Search, filters and view controls for one list, in one row; on phones the filters move behind a Filters button, and filters an agent set stay marked as the agent's until a person changes them.

Status: beta

## Anatomy

1. **Search**: a small Search input, up to 288px wide once the bar is 52rem (728px), full width below; `/` focuses it from anywhere.
2. **Filters**: one small Select per dimension, its name inside the trigger in `ink-3` ("Status All"). A filter that is on takes `accent-tint` with an `accent-line` outline, so the reader sees at once what narrows the list.
3. **Clear**: a ghost button, shown only while something is filtered.
4. **Result**: a quiet count of what passes ("5 of 240"), `text-xs` `ink-3`, once the bar is 60rem (840px).
5. **View controls** (optional): a Segmented control or a menu on the right.
6. **Filters button** (phones): with a count of the filters set on an `accent` disc (the search is not one of them); it opens a Sheet holding each filter as a Field, the view controls, Clear filters and Show results.
7. **Ask** (optional, `ask`): an `AskAbout` that hands the filtered list to an agent. It stays in the bar at every width, last, beside the Filters button on a phone: handing the list over is not a filter, so it never moves into the sheet.
8. **Provenance line** (when `setBy`): the Agent mark (small), "Set by Claude · these filters came from the assistant", and Clear.

## Variants

| Variant | Use |
|---|---|
| Search only | A short list: one search field |
| Search and filters | The default for a log or a directory |
| With view | When the same rows can be seen as a table or a chart |
| Set by an agent | The view was opened by an agent's tool call with filter arguments |

## Sizes

Every control is `control-sm` (32px; 28px compact), 8px apart. The bar sits inside a Data table's toolbar band or directly above a list.

## States

| State | What changes |
|---|---|
| Rest | Every filter on its first option ("All") |
| A filter on | That trigger takes `accent-tint` and `accent-line`; Clear appears; the phone count rises |
| Focus | Each control's own ring |
| Set by an agent | The provenance line under the row, until any filter or the search changes |
| No results | The list below shows its filtered-out empty state; the bar does not change |

## Behaviour

- Changing any filter or the search sets the page back to 1 and removes the agent mark.
- Clear returns every filter to its first option and empties the search, in one write.
- The bar holds no state: the page owns it, usually in the address (`useQueryState`), so the filtered view is a link.

## Surfaces

- **Console**: one row.
- **Mobile**: once the bar is narrower than 52rem (728px), search plus the Filters button; the Sheet rises from the bottom with Show results as its primary action. Under 336px (24rem) the search takes a line of its own and Filters and Ask share the line under it: the three need 336px on one line, and a 320px phone's card gives the bar 246px. The bar reads its OWN width (a container query), not the window's, because the rail, a split row, the assistant's column and an embed all narrow the bar without narrowing the window: 52rem keeps the search and the filters on one row, 60rem also shows the result count. One rem is 14px here, so these are 728px and 840px.
- **Embed**: inline views show no bar (the tool's arguments are the filters, named in the title); fullscreen shows the full bar with the provenance line.

## Agents

Filter names match tool arguments (`status`, `method`, `region`, `q`), so an agent that calls `zz_meridian_requests { status: "5xx" }` opens the same view a person would build. The view adds `by=Claude` to the address, which shows the provenance line; the person's first change clears it.

## Accessibility

- Each Select is named by its filter ("Status"); the search field is named by its placeholder's purpose.
- The phone Filters button states the count in its text, not only on the disc.

## Content

- Filter names are the dimension, singular: "Status", "Region". The off option is "All".
- The search placeholder says what it searches when it fits ("Search requests").

## Do and do not

- Do keep three filters or fewer in the row; more belong in the Sheet on every width.
- Do not invent a filter the data cannot answer; do not use a filter as navigation.

## Implementation

```tsx
<FilterBar
  search={{ value: f.q, onChange: (q) => set({ q, by: '', page: '1' }), placeholder: 'Search requests' }}
  filters={[{ key: 'status', label: 'Status', value: f.status, onChange: (status) => set({ status, by: '', page: '1' }), options: [{ value: 'all', label: 'All' }, …] }]}
  result={<>{matching.length} of {rows.length}</>}
  setBy={f.by || undefined}
  onClear={clear}
/>
```
