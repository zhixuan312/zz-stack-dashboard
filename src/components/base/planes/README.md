# Planes

The planes are what a page stands on: a lit ground, a translucent frame for the rail, and surfaces that step toward the reader, so depth comes from light and planes rather than from borders everywhere.

Status: beta

## Anatomy

1. **Ground** (`ground`): the page. On it, fixed behind everything, the **light** (`glow-ground`: the accent from the top right, a trace of teal from the top left, a violet trace below), painted once as the root's background. There is no grain: a repeated texture under translucent cards stalls rasterisation on high-density screens (decision 0006).
2. **Frame** (`frame`): the rail's translucent wash, blurred, with a `line` hairline on its edge.
3. **Surface** (`surface`): cards and tables, one step toward the reader, with a lit top edge on dark (`highlight-top`).
4. **Surface sunk** (`surface-sunk`): recessed areas inside a surface: table heads, wells, tracks.
5. **Surface raised** (`surface-raised`): what floats: menus, dialogs, toasts, with `shadow-overlay`.
6. **Surface inverse** (`surface-inverse`): tooltips and the cursor flag.
7. **Scrim** (`scrim`): behind dialogs and the drawer.

## Values

| Role | Dark (default) | Light |
|---|---|---|
| `ground` | `#090A0F` | `#EDF0F8` |
| `frame` | black at 22% | white at 42% |
| `surface` | `#121319` | `#FFFFFF` |
| `surface-sunk` | `#0C0D12` | `#F2F5FD` |
| `surface-raised` | `#1B1D23` | `#FFFFFF` |
| `surface-inverse` | `#E9EBF3` | `#121319` |
| Light | accent at 17%, teal at 5% | accent at 12%, teal at 4% |

The neutral leans indigo (275°) at low chroma, so the dark ground reads as night sky rather than grey.

## Behaviour

- The root carries the ground colour and the body stays transparent, so the light shows behind every page; the document never scrolls, so neither does the light.
- The light is made of the accent, so a preset relights every page.
- `data-theme` on any element scopes that subtree to a theme; the Atlas uses it to show both side by side.

## Surfaces

- **Console** and **Mobile**: as specified.
- **Embed**: no light; `ground` and `frame` are transparent so the host shows through, and the surfaces take the host's background colours through the token bridge.

## Agents

Not applicable.

## Accessibility

- Contrast is computed on every plane in both themes (`node scripts/contrast.ts`): `ink` on `ground` 18.1:1 (dark), `ink-3` on `ground` 6.9:1 (dark) and 4.7:1 (light).
- The light is below any contrast threshold and never carries meaning.

## Do and do not

- Do separate with planes and space first, hairlines second, shadows only for what floats.
- Do not add a new plane colour; if something needs to stand apart, it is a Featured metric, not a sixth surface.

## Implementation

`src/styles/base.css` (the ground and the light) and the `surface` roles in `tokens/theme.*.tokens.json`. Utilities: `bg-ground`, `bg-frame`, `bg-surface`, `bg-surface-sunk`, `bg-surface-raised`, `bg-surface-inverse`, `bg-scrim`.
