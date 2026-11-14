# Field

A field is a question and the control that answers it: the label above, the control, and a hint or an error under it.

Status: beta

## Anatomy

1. **Label**: `text-sm` 13px, `weight-medium`, `ink`. A required field adds a `critical-ink` asterisk.
2. **Optional tag** (optional): "Optional" in `text-xs` `ink-3`, when the form marks optional fields instead.
3. **Action** (optional): a small link on the label's line, right-aligned: "Generate", "Use default". It carries `hit`, so it answers 44px to a finger though it reads as a word.
4. **Control**: an Input, Textarea, Select or any control that takes the handed props.
5. **Hint**: one line in `text-xs` `ink-3`: the format, the limit, what happens next.
6. **Error**: replaces the hint: `text-xs` `critical-ink` with a 14px alert icon.

## Spacing

Label to control and control to hint: `space-1-5` 6px. Fields in a form stack `space-5` 20px apart; in a two-column grid, columns are 20px apart.

## States

| State | What changes |
|---|---|
| Rest | label, control, hint |
| Invalid | the error replaces the hint; the control gets `aria-invalid` and its red outline |
| Disabled | the control is disabled; the label stays `ink`, so the field can still be read |

## Behaviour

- Field generates the control's id and hands it, with `aria-describedby`, `aria-invalid` and `aria-required`, to the control through a render prop. No page writes an id.
- Field shows the `error` it is given; the form decides when to set it (on blur or submit) and clears it as soon as the value is valid.

## Surfaces

- **Console**: as specified; forms sit in a Form section, whose card stops at `field-width`, two fields per row where they are short and related.
- **Mobile**: one field per row.
- **Embed**: only search and filter fields, usually without a visible label (they take `aria-label`).

## Agents

An agent never fills a field. When an agent proposed the saved value, the hint can say so: "Set by Claude for Jonas Weber, 2 h ago".

## Accessibility

- The label is a real `<label for>`; the hint or error is the control's description; the error has `role="alert"`.
- Label `ink` 18.1:1; hint `ink-3` 5.3:1; error `critical-ink` on `surface` at least 4.5:1 in every theme (`pnpm contrast`).
- The asterisk is decorative (`aria-hidden`); `aria-required` carries the meaning.

## Content

- Labels are nouns, sentence case, no colon: "Key name", "Webhook URL".
- Errors say what is wrong and how to fix it: "Enter a whole number between 10 and 10,000." Not "Invalid input".
- Hints say what the person cannot see: "Shown in logs and the activity feed."

## Do and do not

- Do mark required fields or optional ones, never both in one form.
- Do not put instructions in the placeholder; they vanish as the person types.

## Implementation

```tsx
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

<Field label="Webhook URL" required hint="Must start with https://." error={error}>
  {(p) => <Input {...p} value={url} onChange={(e) => setUrl(e.target.value)} />}
</Field>
```

Props: `label`, `hint`, `error`, `required`, `optional`, `action`, `children(props)`.
