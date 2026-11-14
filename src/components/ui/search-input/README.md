# Search input

A search input filters what is on screen as the reader types, with a clear button once there is text and an optional key that focuses it from anywhere.

Status: beta

## Anatomy

1. **Frame**: an Input with `type="search"`.
2. **Glass**: the leading search icon, `ink-3`.
3. **Text**: the query, or the placeholder naming what is searched: "Search requests".
4. **Shortcut hint** (optional): a Kbd ("/") shown while empty, hidden on phones.
5. **Clear**: a 24px button with an X, shown once there is text.

## Sizes

Input's sizes: sm 32, md 38, lg 46px.

## States

Input's states, plus:

| State | Visual |
|---|---|
| Empty | glass, placeholder, the shortcut hint |
| Filled | glass, query, the clear button (hover `fill-hover`) |

## Behaviour

- Filters as the reader types. The input itself is controlled and never waits. Where each change is a navigation (a view whose state is its address), the caller keeps the text with `useSearchDraft` from the data table, which writes once the typing has stopped for 250ms and at once when the search is cleared.
- Escape clears the query; a second Escape leaves the field. The clear button returns focus to the field.
- A caller's `onKeyDown` runs first. It can consume a key with `preventDefault()`; observing keys does not disable the search's Escape behavior.
- Escape during an in-progress IME composition belongs to the input method; it does not erase the query or blur the field.
- A disabled or read-only query cannot be cleared by its button; Escape preserves a read-only query. A disabled search does not consume its global shortcut.
- The shortcut key focuses the field unless focus is already in a text control.
- The query belongs in the URL (`?q=`), so a filtered view can be shared and an agent can open it.

## Surfaces

- **Console**: in a table's toolbar, 240 to 320px wide.
- **Mobile**: the full width of the toolbar's first row; no shortcut hint.
- **Embed**: the one input an embed may carry, to narrow a list the tool returned.

## Agents

An agent can open a view already filtered (`?q=parallax`); the input then shows the query like any other. When the filter came from the agent, the toolbar says so with an Agent mark ("Filtered by Claude").

## Accessibility

- `role="searchbox"`, named by `aria-label` ("Search requests").
- The clear button is named "Clear search". The shortcut is announced through the hint only when visible.

## Content

- Placeholder: "Search" plus the thing: "Search requests", "Search customers".

## Do and do not

- Do keep one search per list.
- Do not search on Enter only; filter as the reader types.

## Implementation

```tsx
import { SearchInput } from '@/components/ui/search-input';

<SearchInput aria-label="Search requests" placeholder="Search requests" value={q} onValueChange={setQ} shortcut="/" />
```

Props: `value`, `onValueChange`, `shortcut`, `size`, `placeholder`, and the Input props except `leading`, `trailing` and `type`.
