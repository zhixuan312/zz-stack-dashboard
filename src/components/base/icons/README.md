# Icons

Icons are Lucide line icons at a 1.75 stroke in `currentColor`, at three sizes; they decorate, and the control beside them always carries the name.

Status: beta

## Anatomy

1. **Glyph**: a Lucide icon, `strokeWidth={1.75}`, coloured by its context (`ink-3` at rest in navigation, `accent-ink` when current, `currentColor` in buttons).

## Sizes

| Size | Use |
|---|---|
| 14px (`size-3.5`) | Small buttons, tile heads, inline links |
| 16px (`size-4`) | The default: buttons, navigation, menus |
| 18px (`size-[18px]`) | Large buttons, the menu trigger |

## Behaviour

- An icon in a control inherits the control's colour and changes with it over `dur-hover`.
- A trailing arrow moves 2px on hover (see Button).

## Surfaces

Same on every surface.

## Agents

The Agent mark uses Lucide's sparkles; no other icon may suggest an agent.

## Accessibility

- Icons are `aria-hidden`. An icon-only control has an `aria-label` (Icon button requires it).

## Do and do not

- Do use one family. Never mix in filled icons or another set.
- Do not use an icon in place of a word a person needs to read.

## Implementation

```tsx
import { Download } from 'lucide-react';

<Button icon={<Download />}>Export</Button>
```
