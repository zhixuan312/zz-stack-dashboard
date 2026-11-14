# Icon button

An icon button is one action shown as an icon alone: close, refresh, copy, more. It is square, the height of a control, and always carries a name.

Status: beta

## Anatomy

1. **Container**: a square at the control height. Secondary has a 1px `line-strong` border and `shadow-control`; ghost has none.
2. **Icon**: one Lucide icon at 1.75 stroke, `currentColor`.
3. **Name**: `label`, required. It is the `aria-label`, and the tooltip when `tooltip` is set.

## Variants

| Variant | Use | Fill | Border | Icon |
|---|---|---|---|---|
| Ghost (default) | Card heads, toolbars, the close of a dialog | transparent | none | `ink-3` |
| Secondary | Beside outlined controls: next to a Select or a secondary Button | `surface` | `line-strong`, `shadow-control` | `ink-2` |

## Sizes

| Size | Box | Icon | Radius |
|---|---|---|---|
| sm | `control-sm` 32px (28 compact) | 14px | `radius-md` 10px |
| md (default) | `control-md` 38px (32 compact) | 16px | `radius-md` 10px |
| lg | `control-lg` 46px (38 compact) | 18px | `radius-lg` 16px |

## States

| State | Ghost | Secondary |
|---|---|---|
| Rest | as above | as above |
| Hover | fill `fill-hover`, icon `ink` | fill `surface-sunk`, icon `ink` |
| Pressed | scale 0.985 over `dur-press` | same |
| Focus (keyboard) | 2px `accent` outline, 2px offset | same |
| Pressed toggle (`pressed`) | fill `fill-active`, icon `ink`, `aria-pressed="true"` | same |
| Disabled | 45% opacity, no pointer events | same |

Fill and colour change over `dur-hover` 160ms.

## Behaviour

- Runs on click, Enter or Space. With `pressed`, it is a toggle and announces its state.
- `tooltip` shows the label after 300ms of hover, at once on keyboard focus, and never holds anything but the label.

## Surfaces

- **Console**: as specified.
- **Mobile**: in a toolbar that is the page's main interaction, use `lg` so the target is 44px.
- **Embed**: same; an icon button in an embed acts through the host.

## Agents

Not applicable.

## Accessibility

- The `label` is required by the type: an icon names nothing.
- Icon `ink-3` on `surface` 5.3:1 (light, cobalt); it clears 3:1 as a graphic in every theme.
- Use `tooltip` whenever the icon is not universally understood (refresh, copy); close and more need none.

## Content

- The label is a verb phrase that would work as a button label: "Copy request ID", "Refresh", "More actions".

## Do and do not

- Do keep one meaning per icon across the product: the same icon never does two things.
- Do not use an icon button for the primary action of a view; use Button with a label.

## Implementation

```tsx
import { IconButton } from '@/components/ui/icon-button';

<IconButton label="Refresh" icon={<RefreshCw />} tooltip />
<IconButton variant="secondary" size="sm" label="Close" icon={<X />} />
```

Props: `label` (required), `icon`, `variant` (`ghost` | `secondary`), `size` (`sm` | `md` | `lg`), `tooltip`, `pressed`, and every native button attribute.
