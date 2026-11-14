# Avatar

An avatar stands for a person or an organisation: their picture, or their initials on a soft tint of a chart hue derived from the name, so the same person always has the same colour. Avatar group shows several at a glance.

Status: beta

## Anatomy

1. **Disc**: a circle (`radius-full`) with a 2px `surface` ring, so overlapping discs stay separate.
2. **Picture** (optional): the person's image, cropped to cover.
3. **Initials**: the first character of the first two words, `weight-semibold`, when there is no picture or the picture does not load.
4. **Overflow chip** (group only): "+N" on `fill-active`, `ink-2`.

## Variants

| Variant | Use |
|---|---|
| Avatar | One person beside their name, in a list, in the rail's account row |
| Avatar group | Who is involved: reviewers, members of a team. Up to `max` (4) discs tucked under each other by 2, 4 or 6px (sm, md, lg), so the ring draws the seam and never cuts an initial, then "+N" |

The tint is derived, never chosen: the name's character codes pick one of the six chart slots. Ground: the slot at 22% over `surface`; initials: the slot at 52% toward `ink`. Soft ground, strong glyph, so it reads in both themes without a contrast exception.

## Sizes

| Size | Disc | Initials | Overlap in a group |
|---|---|---|---|
| sm | 24px | `text-2xs` 11px | 2px |
| md (default) | 32px | `text-xs` 12px | 4px |
| lg | 40px | `text-sm` 13px | 6px |

## States

Not interactive. A clickable person is a link around the avatar and the name together, with the link's focus ring.

## Behaviour

Decorative (`aria-hidden`): the name beside it is the information. A group carries the full list of names as its accessible name.

A picture that fails falls back to initials. Changing `src` starts a fresh image attempt; a previous failure does not stick, including when returning to an earlier URL.

## Surfaces

Same on every surface. In an embed, the `surface` ring takes the host's background through the bridge.

## Agents

An agent never has an avatar: its sign is the square Agent mark. A round disc always means a person.

## Accessibility

- Initials are decorative; the adjacent name is read.
- Avatar group: `role="img"` named by every name, so "+3" is never all a screen reader hears.

## Content

Initials from the first two words of the name: "Maya Chen" → MC, "Northwind Labs" → NL.

## Do and do not

- Do show the name next to a single avatar wherever there is room.
- Do not pick an avatar colour by hand or by role; it is derived so it stays stable.
- Do not use an avatar for a system actor (the product itself); use a neutral dot.

## Implementation

```tsx
import { Avatar, AvatarGroup } from '@/components/ui/avatar';

<Avatar name="Maya Chen" />
<AvatarGroup names={['Maya Chen', 'Jonas Weber', 'Amara Okafor']} max={4} size="sm" />
```

`Avatar`: `name`, `src`, `size` (`sm` | `md` | `lg`), `className`. `AvatarGroup`: `names`, `max`, `size`, `className`.
