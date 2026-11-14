# Sheet

A sheet is a panel that slides in from the right for work that needs the page beside it: a record's details from a list, a set of filters, an edit form. Under 640px it rises from the bottom.

Status: beta

## Anatomy

1. **Scrim**: `scrim` over the page.
2. **Panel**: `surface-raised`, a `line` edge on its left, `shadow-overlay`.
3. **Head**: title (`t-section`), optional description, close; a hairline under it.
4. **Body**: scrolls inside the panel.
5. **Footer** (optional): actions on a `surface-sunk` band.

## Sizes

440px wide, the full height; at most the viewport less 48px. Head 20px 24px 16px; body 20px 24px; footer 14px 24px. On phones: full width, up to 88% of the height, top corners `radius-xl`.

## States

| State | Spec |
|---|---|
| Opening | Slides in from the right edge over `dur-enter` 320ms `ease-out`; from the bottom on phones |
| Closing | Fades over `dur-exit` 140ms |
| Loading | The body shows Skeletons in the shape of what is coming |

## Behaviour

- Modal: focus moves in, is trapped, and returns to the trigger on close. Escape, the close button and the scrim close it.
- Opening a record in a sheet updates the URL (`?request=req_…`), so it can be linked and the back button closes it.

## Surfaces

- **Console**: from the right.
- **Mobile**: from the bottom, full width, safe-area padding.
- **Embed**: not used inline; in fullscreen, as on the console.

## Agents

When an agent opens a record for a person ("show me the slowest request"), the record opens in this sheet, with the address it used.

## Accessibility

- Radix Dialog: `role="dialog"`, `aria-modal`, labelled by the title.
- Title `ink` on `surface-raised` 18.5:1; description `ink-2` 7.1:1 (light, cobalt).

## Content

- The title is the record's name: "POST /v1/messages"; the description its identity: "req_8f3k2m1x · 4 minutes ago".

## Do and do not

- Do use a sheet when the person will compare with what is behind it.
- Do not open a sheet from a sheet.

## Implementation

```tsx
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

<Sheet>
  <SheetTrigger asChild><Button>Open request</Button></SheetTrigger>
  <SheetContent title="POST /v1/messages" description="req_8f3k2m1x" footer={<Button>Replay request</Button>}>…</SheetContent>
</Sheet>
```

The enter motion from the right is a starting style and a transform transition, not a keyframe, because the leave is a fade: `motion.css`'s `.sheet-in` runs both directions and would fight it. The phone's rise from the bottom does use the `m-sheet-up` keyframe, inline, for the same reason — the class beside it animates the close too.
