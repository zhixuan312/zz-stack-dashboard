# Toast

A toast confirms, in one line, something that just happened (a key revoked, an export failed, an ID copied) and leaves on its own.

Status: beta

## Anatomy

1. **Surface**: `surface-raised`, `radius-lg` 16px, 14px padding, `shadow-overlay`.
2. **Icon**: 16px; `positive` check, `critical` cross, or `ink-3` info.
3. **Title**: `text-sm` medium, `ink`; the past tense of the action.
4. **Description** (optional): `text-xs`, `ink-2`; what it means.
5. **Action** (optional): one text button in `accent-ink`, usually Undo.
6. **Dismiss**: a 24px ghost close.

## Variants

| Tone | Use |
|---|---|
| Positive | An action the person took completed |
| Critical | It failed; the toast says what failed and what to do |
| Neutral | Information: Copied, Saved as draft |

## Sizes

Width 380px (the viewport less 32px on phones); stack of at most three, 8px apart, newest last.

## States

| State | Spec |
|---|---|
| Entering | Rises 12px and scales from 98% over `dur-enter` 320ms `ease-out` |
| Shown | 5 seconds; 8 seconds with an action (`UNDO_MS`); neither counts while the pointer is over the stack or focus is in it |
| Leaving | Removed; the stack closes up |

## Behaviour

- `toast({ tone, title, description, action, onClose })` from anywhere; the Toaster is mounted once in the providers.
- A fourth toast pushes the oldest out.
- Running the action dismisses the toast.
- `onClose` runs once when the toast leaves, whichever way: its time ran out, the action or Dismiss was pressed, or a fourth toast pushed it out. A change held for an Undo commits there, so its window is the toast's own and waits with it.

## Surfaces

- **Console**: bottom right, 16px from the edges.
- **Mobile** (below 640px): top, full width less 16px each side, below the safe area, so a bottom sheet's actions are never under a toast.
- **Embed**: not used; the host owns notifications. A completed action in an embed changes the view itself.

## Agents

When an agent's approved proposal applies, the toast names the agent: "Rate limit raised · by Claude for Jonas Weber".

## Accessibility

- Positive and neutral announce politely (`role="status"`), critical assertively (`role="alert"`).
- A toast never holds the only copy of important information; the change is visible on the page too.
- Title `ink` on `surface-raised` 18.5:1; action `accent-ink` 6.6:1 (light, cobalt).

## Content

- Title in the past tense, the same verb as the button: button "Revoke key", toast "Key revoked".
- No "Success!" and no exclamation marks.

## Do and do not

- Do offer Undo instead of a confirmation dialog when an action can be reversed.
- Do not use a toast for an error the person must act on; use a Banner or the field's error. A form in an open sheet or dialog that fails shows its error inside the form, at the top, and keeps what was typed: a toast would land on the form's own actions.

## Implementation

```tsx
import { toast } from '@/components/ui/toast';

toast({ tone: 'positive', title: 'Webhook paused', action: { label: 'Undo', onClick: resume } });
```

`ToastView` draws one toast without the store, for previews and custom stacks.
