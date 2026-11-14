# Command palette

The command palette puts every destination and every global action behind one keystroke: type to filter, move with the arrows, press Enter to go.

Status: beta

## Anatomy

1. **Query**: a 56px input with a search icon, `text-md`, and an Esc hint.
2. **Results**: commands grouped under eyebrows ("Go to", "Appearance"), each a 40px row with an icon, a label, an optional hint (its group, or its parent's label for a sub page) and, on the highlighted row, an Enter glyph.
3. **Key hints**: a `surface-sunk` band at the foot: ↑ ↓ move, ↵ open, ⌘K toggle (Ctrl K off an Apple keyboard: `usePaletteKey()` names the reader's key once the page has hydrated; the server draws ⌘K).

## Composition

A Dialog (`surface-raised`, `radius-xl` 24px, `shadow-overlay`, 600px wide, 14% of the viewport from the top) holding `CommandPanel`, which is the panel without its dialog: the Atlas renders it inline. Kbd for every key.

## Data

Commands are built from the `nav` prop, the same groups the Rail gets (one "Go to" per destination, its group as the hint, or for a sub page its parent's label) and the appearance actions. A match ranks by where the query starts in the label, then by the original order; the hint also matches, so typing a parent's label finds its sub pages, and where a navigation names its groups ("billing" finds every entry under Billing; the sample's groups carry no name). Like the Rail's, `nav` carries each entry's icon as a component, so it cannot be built in a server component — see the Rail's README.

## States

| State | What shows |
|---|---|
| Closed | Nothing; ⌘K or Ctrl K, or the Search pill, opens it |
| Open, empty query | Every command, grouped, the first highlighted |
| Field focused | The search band's hairline takes `accent` and the search icon `accent-ink`, over `dur-hover`: the same signal a field's outline gives |
| Filtered | The matches, re-ranked; the highlight returns to the first |
| No match | One line: "Nothing matches “…”. Try a page’s name." |
| Highlighted row | `fill-hover`; its icon steps up to `ink-2` |

The dialog enters with `dialog-in` (rise and fade over `dur-enter`) and leaves faster.

## Behaviour

- ⌘K or Ctrl K toggles it from anywhere; Escape and the scrim close it.
- ↑ and ↓ move the highlight and keep it in view; the pointer moves it too; Enter or a click runs the command and closes the palette. A destination asks "Leave without saving?" first while a form on the page has unsaved changes (the shell's `useLeave`).
- Closing clears the query.

## Surfaces

- **Console**: centred, 600px.
- **Mobile**: a sheet from the bottom of the screen, `rounded-t-xl`, as every other dialog is under 640px; the ⌘K hint hides. Its result rows answer 44px under a finger (`pointer-coarse:h-11`) and stay 40px with a pointer.
- **Embed**: absent; a view in a host has no global navigation.

## Agents

Not applicable. An agent runs tools directly; it never drives the palette.

## Accessibility

- A dialog named "Search and commands"; the input is a combobox controlling the listbox, with `aria-activedescendant` on the highlighted option.
- Contrast (dark): labels `ink` on `surface-raised` 15.5:1, hints and eyebrows `ink-3` 5.8:1.

## Content

- Destinations use the rail's labels exactly. Actions start with a verb: "Use the dark theme".
- The no-match line suggests what does work.

## Do and do not

- Do add a command for any global action a person would otherwise hunt for.
- Do not add page-specific actions; those belong on the page.

## Implementation

```tsx
import { nav } from '@/app.config';
import { CommandPalette } from '@/components/patterns/command-palette';
import { openCommand } from '@/components/patterns/command-palette/open';

<CommandPalette nav={nav} /> // once, in the console layout; the console mounts `ConsolePalette`, which filters `nav` by access
<button onClick={openCommand}>Search</button>
```

The palette is a chunk of its own: `ConsolePalette` loads it with `next/dynamic` once the page has hydrated, so no
page's first load carries it. Anything that only opens it or names its key imports `openCommand` and `usePaletteKey`
from `./open`, never from the palette's own file, or the palette comes back into that page's first load. A press that
lands before the palette has mounted opens it as soon as it does.

`CommandPanel` takes `query`, `onQuery`, `commands`, `at`, `onAt`, `onRun` for an inline rendering.
