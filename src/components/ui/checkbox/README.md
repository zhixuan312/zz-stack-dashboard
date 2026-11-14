# Checkbox

A checkbox is a yes or no that takes effect when the form is saved, or a row picked out of a table; it can be indeterminate when it stands for a set that is partly chosen.

Status: beta

## Anatomy

1. **Box**: 16px, `radius-xs`, 1px `line-control` on `surface`; its hit area extends 8px on every side (32px).
2. **Mark**: a 12px check, or a dash when indeterminate, in `on-accent`.
3. **Label** (optional): `text-sm` `ink`, beside the box, clickable.
4. **Description** (optional): one line under the label in `text-xs` `ink-3`. It describes the control (`aria-describedby`); the label alone names it.

## States

| State | Visual |
|---|---|
| Off | outline `line-control` (3:1 on surface: the outline is the only signal) |
| Hover | outline `ink-3` |
| On | fill and outline `accent`, check `on-accent` |
| Indeterminate | fill `accent`, a dash |
| Focus (keyboard) | 2px `accent` outline, 2px offset |
| Invalid | outline `critical` |
| Disabled | fill `surface-sunk`, outline `line-strong`; on: fill `ink-disabled`; the label turns `ink-disabled` |

Fill and outline change over `dur-hover`.

## Behaviour

- In a native form (a server action), pass `name`: the control posts "on" when checked through a hidden native input, so `formData.get(name)` reads it with no extra code.

- Space toggles; a click on the label toggles.
- In a table header, the box selects every row on the page; it shows indeterminate while some are chosen.
- A checkbox changes nothing until the form is saved. A setting that applies at once is a Switch.

## Surfaces

- **Console**: as specified.
- **Mobile**: the 32px hit area holds; in a list of options, the whole row is the target.
- **Embed**: not offered; choices that save happen in the console.

## Agents

Not applicable: choices are a person's. An agent selecting rows to act on proposes the action with the rows listed.

## Accessibility

- Radix Checkbox: `role="checkbox"` with `aria-checked` (`mixed` when indeterminate).
- Named by its label, or by `aria-label` in a table.
- `line-control` on `surface` holds 3:1 in every theme; `on-accent` on `accent` 5.6:1.

## Content

- The label states what is true when checked: "Email me when an incident opens". Not "Enable emails".

## Do and do not

- Do use a group of checkboxes for several independent choices.
- Do not use a checkbox for one of several exclusive choices; that is a Radio group.

## Implementation

```tsx
import { Checkbox } from '@/components/ui/checkbox';

<Checkbox label="Include request bodies in exports" checked={v} onCheckedChange={(c) => setV(c === true)} />
```

Props: `label`, `description`, `checked` (`true` | `false` | `'indeterminate'`), `onCheckedChange`, `disabled`, and the Radix Checkbox root props.
