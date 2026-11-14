# Input

An input takes one line of text, a number or a value with a unit; it always sits in a Field, which names it.

Status: beta

## Anatomy

1. **Frame**: the outline, fill and focus ring. Shared by Input, Textarea and the Select trigger (`controlFrame`).
2. **Leading slot** (optional): an icon or a currency sign, `ink-3`.
3. **Text**: the value, or the placeholder in `ink-3`.
4. **Trailing slot** (optional): a unit ("rpm", "per month"), a clear button or a key hint.

## Sizes

| Size | Height | Padding | Text | Icon | Radius |
|---|---|---|---|---|---|
| sm | `control-sm` 32px (28 compact) | 10px | `text-sm` 13px | 14px | `radius-md` 10px |
| md (default) | `control-md` 38px (32 compact) | 12px | `text-sm` 13px | 16px | `radius-md` 10px |
| lg | `control-lg` 46px (38 compact) | 14px | `text-base` 14px | 18px | `radius-md` 10px |

Fill `surface`; border 1px `line-strong`; `shadow-control`. Slot to text: 6px (sm), 8px (md), 10px (lg).

## States

| State | Visual |
|---|---|
| Rest | border `line-strong`, placeholder `ink-3` |
| Hover | border `line-control` at 40% |
| Focus | border `accent` and a 3px ring of the accent at 22%; any focus (pointer or keyboard), because typing follows |
| Invalid | border `critical`; a red ring on focus; the Field shows the error |
| Disabled | fill `surface-sunk`, border `line`, text `ink-disabled`, no shadow, `not-allowed` cursor |
| Read only | fill `surface-sunk`; the text can still be selected and copied |

Border, ring and fill change over `dur-hover` 160ms.

## Behaviour

- The whole frame is the target: a click on a slot focuses the field (the native input fills the space between).
- Numbers use `type="number"` only for quantities; identifiers (a key, an account number) are text.
- Validation shows on blur or on submit, never on every keystroke while the person is still typing.

## Surfaces

- **Console**: as specified.
- **Mobile**: use `lg` where the input is the screen's main task (sign in, a sheet's single field), so the target is 44px; set `inputMode` and `autoComplete` so the right keyboard opens.
- **Embed**: same; inputs in an embed are filters only (a search, a date). Data entry happens in the console.

## Agents

An agent never types into an input on a person's behalf. When it suggests a value (a rate limit, a budget), the suggestion arrives as a Proposal; approving it fills the saved value, and the activity feed attributes the change to the agent.

## Accessibility

- Named by its Field's label (or `aria-label` when it stands alone, such as a table filter).
- `aria-invalid` and `aria-describedby` come from the Field; the error is announced with `role="alert"`.
- Text `ink` on `surface` 18.1:1; placeholder `ink-3` on `surface` 5.3:1. A placeholder is an example, never the label.

## Content

- Placeholders show the format: "https://hooks.northwind.example/zz-meridian", "/v1/messages". Never "Enter a value". (`.example` is reserved for documentation, so a sample address never points at someone's real domain — `src/app.config.ts` says the same for the product's own.)
- Units are trailing text, not part of the value: "2000" with "rpm".

## Do and do not

- Do size an input to its expected content: a rate limit is short; a URL is wide.
- Do not disable an input to show a value; make it read only, so it can be copied.
- Do not put a second line of help inside the frame; that is the Field's hint.

## Implementation

```tsx
import { Input } from '@/components/ui/input';

<Field label="Rate limit" hint="Requests per minute.">
  {(p) => <Input {...p} type="number" defaultValue={2000} trailing="rpm" />}
</Field>
```

Props: `size`, `leading`, `trailing`, `invalid`, `frameClassName` (the frame), `className` (the native input), and every native input attribute. `controlFrame` and `CONTROL_SIZE` are exported for controls that share the look.
