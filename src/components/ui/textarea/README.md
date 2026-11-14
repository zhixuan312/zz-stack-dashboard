# Textarea

A textarea takes several lines of text, such as a note, a description or a payload, and grows with its content up to a limit.

Status: beta

## Anatomy

1. **Frame**: the shared control frame (`controlFrame`), as Input.
2. **Text**: `text-sm` 13px, line height 1.55, 8px by 12px padding.
3. **Resize handle**: vertical only.

## Sizes

One size. It starts at `rows` lines (3 by default) and grows with its text (`field-sizing: content`) to `maxRows` (10), then scrolls inside. Radius `radius-md` 10px.

## States

Rest, hover, focus, invalid, disabled and read only exactly as Input, over `dur-hover`.

## Behaviour

- Enter adds a line; it never submits. A form with a textarea submits from its button.
- Growth is automatic where the browser supports content sizing; elsewhere the person drags the handle.

## Surfaces

- **Console**: as specified.
- **Mobile**: full width; it grows to `maxRows` (10) as on a desk.
- **Embed**: not offered; long text is written in the console.

## Agents

An agent may draft text (an incident note, a summary) only as a Proposal the person approves or edits; drafted text is never inserted silently.

## Accessibility

- Named by its Field. Text `ink` on `surface` 18.1:1.
- The scroll inside a full textarea is the one exception to "one scroller": it is the person's own text.

## Content

- The placeholder asks the question the text answers: "What changed, and what should the next person on call know?"

## Do and do not

- Do use a textarea for prose; use Input for anything one line long, even if it is long.
- Do not limit length silently; show the limit in the hint and the count when it is close.

## Implementation

```tsx
import { Textarea } from '@/components/ui/textarea';

<Field label="Note">{(p) => <Textarea {...p} rows={3} />}</Field>
```

Props: `rows`, `maxRows`, `invalid`, and every native textarea attribute.
