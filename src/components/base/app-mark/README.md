# App mark

The app mark is the product's sign: the template ships a neutral one, an accent tile holding a trend crossed by the line that reads it, which a product replaces with its own logo.

Status: beta

## Anatomy

1. **Tile**: a 24-unit square with a 6.5-unit radius, filled with `accent` and a soft sheen from the top.
2. **Trend**: a 1.7-unit `on-accent` polyline.
3. **Meridian**: a vertical line about 64% of the way across and a dot where it meets the trend.

## Sizes

| Size | Use |
|---|---|
| 20px | The Embed frame's head |
| 24px | Small headers, toasts |
| 28px | The rail's brand row |
| 32px | Sign-in, the Atlas |

## Behaviour

- The tile is the accent, so the mark follows a preset (graphite gives an ink tile with a dark trend on dark).
- `app.logo` in `src/app.config.ts` replaces the tile with the product's logo: a root-relative local SVG path such as `/logo.svg`, served from `public/`. It renders as an `<img>` at 20, 24, 28 or 32 pixels. A value that is not such a path (a URL, a relative path, another file type) renders the default mark.

## Surfaces

- **Console**, **Mobile**: in the rail.
- **Embed**: at 20px in the Embed frame's head, so a reader knows whose card this is.

## Agents

Not applicable.

## Accessibility

- Beside the visible product name it is decorative: the logo has an empty `alt`, the default mark is `aria-hidden`. Never announce the mark and the name twice.
- Standing alone, pass the product name as `label`: the logo takes it as `alt`, the default mark as `role="img"` with `aria-label`.

## Do and do not

- Do set `app.logo` for your logo and keep the four size steps.
- Do not stretch it, outline it, or set it on a fill that is the accent.

## Implementation

```tsx
import { AppMark } from '@/components/base/app-mark';

<AppMark size={28} />                  {/* beside the name */}
<AppMark size={32} label="Acme Ops" /> {/* on its own */}
```
