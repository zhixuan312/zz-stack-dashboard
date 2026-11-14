# Breadcrumb

A breadcrumb says where a page sits: its ancestors, each a link, then the page itself. It sits above a record's title in the masthead.

Status: beta

## Anatomy

1. **Ancestor**: a link, `ink-2`; it turns `ink` on hover, with no underline.
2. **Separator**: a 12px chevron in `ink-3`, decorative.
3. **Current page**: `ink`, medium, `aria-current="page"`.
4. **Fold** (more than four levels): a 24px ellipsis button that opens a Menu of the hidden levels; a level without an address is listed by name, not as a link.

## Variants

| Variant | When |
|---|---|
| Full | Up to four levels |
| Folded | Five or more: the first, the fold, and the last two |

## Sizes

`text-xs` 12px; 4px between items and separators; one line, always.

## States

| State | Ancestor |
|---|---|
| Rest | `ink-2` |
| Hover | `ink` over `dur-hover` |
| Focus | 2px `accent` outline |

## Behaviour

- Links navigate; the current page is not a link.
- When space runs out, the current page truncates first with an ellipsis; its full name is in the masthead title below. Ancestors wider than the line on their own truncate too, so the trail never runs past its column, and every label the line cuts carries the whole of itself in its own title.

## Surfaces

- **Console**: as specified.
- **Mobile**: the same fold, at five levels; the narrower line truncates the current page sooner.
- **Embed**: not shown; an embed has one view and its own head.

## Agents

Not applicable.

## Accessibility

- `nav` labelled "Breadcrumb" holding an ordered list; separators are hidden from assistive technology.
- Ancestor `ink-2` on `ground` 6.2:1; separator `ink-3` is decorative (light, cobalt).

## Content

- Use each page's own title, as it appears in its masthead.

## Do and do not

- Do show it on detail pages, two or more levels deep.
- Do not show it on top-level pages; the rail already says where you are.

## Implementation

```tsx
import { Breadcrumb } from '@/components/ui/breadcrumb';

<Breadcrumb items={[{ label: 'Requests', href: '/requests' }, { label: 'req_8f3k2m1x' }]} />
```
