# Kbd

A kbd shows a key or a chord as the keyboard labels it, so a shortcut can be read where its action lives.

Status: beta

## Anatomy

1. **Key**: a 20px-tall cap, at least 20px wide, `radius-xs`, 1px `line-strong` on `surface` with `shadow-control`.
2. **Glyph**: `text-2xs` 11px, `weight-medium`, `ink-3`, in the sans face (symbols such as ⌘ and ↵ read better there than in mono).

## States

One state: it is a label, not a control.

## Behaviour

None. The shortcut it names is handled by the component it sits in.

## Surfaces

- **Console**: beside the action (the rail's search, a menu item, the command palette footer).
- **Mobile**: hidden; phones have no keyboard to press.
- **Embed**: hidden; the host owns the keyboard.

## Agents

Not applicable.

## Accessibility

- A `<kbd>` element. Glyph `ink-3` on `surface` 5.3:1.
- Never the only way to learn an action: the action is also a visible control.

## Content

- Use the symbols the platform prints: ⌘K, Esc, ↵, ↑ ↓. A chord is two keys with "then" between them.

## Do and do not

- Do show a shortcut only where it is real and handled.
- Do not chain more than two keys.

## Implementation

```tsx
import { Kbd } from '@/components/ui/kbd';

<Kbd>⌘K</Kbd>
```
