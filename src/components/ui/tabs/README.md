# Tabs

Tabs switch between views of one subject, one at a time: a request's Overview, Headers and Body; a list's All, Failed and Slow.

Status: beta

## Anatomy

1. **Strip**: the row of tabs on a 1px `line` baseline.
2. **Tab**: a text label, `text-sm` medium; `ink-2` at rest, `ink` when current.
3. **Count** (optional): a pill after the label; `fill-track` and `ink-2`, or `accent-tint` and `accent-ink` on the current tab.
4. **Indicator**: a 2px `accent` line under the current tab, sitting on the baseline.
5. **Panel**: the content of the current tab, 20px below the strip.

## Variants

| Variant | Use |
|---|---|
| Default | Views of one record or one page |
| With counts | Views that filter one list: each says how many it holds |
| Links (`LinkTabs`) | Views that are routes of their own, each tab a link with its own address: the current one has `aria-current="page"` and the accent line, and the page renders the view itself; no panels |

## Sizes

Tab height 40px, padding 10px, gap 4px; the first tab's text aligns with the content edge (its padding hangs outside). Count: `text-2xs` semibold, 6px padding, full radius.

## States

| State | Tab |
|---|---|
| Rest | `ink-2` |
| Hover | `ink` |
| Current | `ink`; the indicator slides under it over `dur-enter` 320ms `ease-out` (transform and width) |
| Focus (keyboard) | 2px `accent` outline drawn inside the tab |
| Disabled | `ink-disabled`, skipped by the arrow keys |

## Behaviour

- Radix Tabs: arrow keys move between tabs and select them, Home and End jump, Tab moves into the panel.
- A tab that is a view of a URL (a sub-route) is a link styled as a tab; its current state comes from the route. The page changes with it, so its indicator is drawn under the current tab rather than slid.
- Changing tab never scrolls the page; on a narrow strip it scrolls the strip to keep the chosen tab in view.

## Surfaces

- **Console**: as specified.
- **Mobile**: the strip scrolls sideways with snap points and no scrollbar; it never wraps to a second line. The one exception to "nothing scrolls sideways".
- **Embed**: fullscreen embeds use tabs in place of the rail; inline embeds show one view and no tabs.

## Agents

An agent selects a tab by opening the view's address (for example `?tab=failed`); the tab shows it like any other selection.

## Accessibility

- `role="tablist"`, `tab` with `aria-selected`, `tabpanel` labelled by its tab; the arrow keys move between tabs.
- `LinkTabs` is a `nav` landmark named by `label`, its links in the Tab order, the current one `aria-current="page"`.
- Current label `ink` on `surface` 18.5:1; rest `ink-2` 7.1:1; the indicator `accent` holds 3:1 on every surface (light, cobalt).

## Content

- One or two words, sentence case, nouns: "Overview", "API keys", "Failed".
- A count is the number of items in that view, not a badge of urgency.

## Do and do not

- Do keep six tabs or fewer on a page; beyond that the views belong in navigation.
- Do not use tabs for steps of a flow; they are peers, not a sequence.
- Do not put a primary action in the strip.

## Implementation

```tsx
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/tabs';

<Tabs defaultValue="all">
  <TabList aria-label="Requests">
    <Tab value="all" count="240">All</Tab>
    <Tab value="failed" count="12">Failed</Tab>
  </TabList>
  <TabPanel value="all">…</TabPanel>
</Tabs>
```
