# Dialog

A dialog holds one task at a time over a dimmed page: confirm a destructive action, create a key, edit a short form. On phones it rises from the bottom as a sheet.

Status: beta

## Anatomy

1. **Scrim**: `scrim` over the page, dimming it; no blur, which cost a phone more than 100 ms on every open.
2. **Panel**: `surface-raised`, `radius-xl` 24px, `shadow-overlay`.
3. **Head**: title (`t-section`, 24–32px), optional description (`t-small`, `ink-2`), close (32px ghost icon button).
4. **Body**: the task; scrolls inside the panel when it is taller than the viewport.
5. **Footer** (optional): actions on a `surface-sunk` band, Cancel first, the primary last.

## Variants

| Variant | Use |
|---|---|
| Confirm | A destructive or irreversible action: says what will happen and what it touches; the danger button names the action. |
| Form | A short task with two to five fields. |
| Information | A longer explanation with one Close. Prefer a Sheet if the reader needs the page beside it. |

## Sizes

| Size | Width |
|---|---|
| sm | 400px |
| md (default) | 520px |
| lg | 720px |
| xl | 960px |

A table of up to six columns goes in an `xl` dialog. Past six columns, or when the reader needs the page beside it, the table goes on its own page.

Head padding 20px 24px 4px; body 12px 24px 24px; footer 14px 24px. Maximum height 720px or the viewport less 32px.

## States

| State | Spec |
|---|---|
| Opening | Scrim fades in; the panel rises 10px and scales from 98% over `dur-enter` 320ms `ease-out` |
| Closing | Fade and scale to 98% over 140ms |
| Error | A Banner (critical) at the top of the body says what failed; the fields keep their values |

## Behaviour

- Focus moves to the first field (or the close button) on open, is trapped inside, and returns to the trigger on close.
- Escape, the close button and the scrim close it.
- Enter in a single-field form submits.

## Surfaces

- **Console**: centred.
- **Mobile**: under 640px it is a bottom sheet: full width, top corners rounded, safe-area padding, footer buttons stacked with the primary on top.
- **Embed**: in inline mode a dialog is not used; the task opens in the console. In fullscreen it behaves as on the console.

## Agents

When an agent proposes a write, it arrives as a Proposal on the page, not as a dialog; a person may open the proposal's details in a dialog. An agent never confirms a dialog.

## Accessibility

- Radix Dialog: `role="dialog"`, `aria-modal`, labelled by the title and described by the description.
- Title `ink` on `surface-raised` 18.5:1; description `ink-2` 7.1:1 (light, cobalt).

## Content

- The title is the question or the task: "Revoke this key?", "Create API key".
- The description says the consequence in one sentence: "Requests signed with it will fail with 401 at once."
- The danger button repeats the verb: "Revoke key", never "OK" or "Yes".

## Do and do not

- Do use a dialog only when the task must interrupt; otherwise inline or a Sheet.
- Do not stack dialogs.
- Do not put a long form in a dialog; give it a page.

## Implementation

```tsx
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

<Dialog>
  <DialogTrigger asChild><Button variant="danger">Revoke key</Button></DialogTrigger>
  <DialogContent title="Revoke this key?" description="Requests signed with it will fail with 401 at once." footer={<><DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose><Button variant="danger">Revoke key</Button></>}>
    …
  </DialogContent>
</Dialog>
```

Props of `DialogContent`: `title`, `description`, `footer`, `size` (`sm` | `md` | `lg` | `xl`). The panel classes are exported (`DIALOG_PANEL`, `DIALOG_HEAD`, `DIALOG_BODY`, `DIALOG_FOOT`) for static mocks.
