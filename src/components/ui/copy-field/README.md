# Copy field

A copy field shows a value someone will take elsewhere (an ID, an endpoint, a secret) read-only in mono, with a Copy button that confirms with a check; a secret stays masked until Reveal.

Status: beta

## Anatomy

1. **Well**: `control-md` tall, `surface-sunk`, 1px `line-strong`, `radius-md`, `shadow-control`.
2. **Value**: `font-mono`, `text-xs`, `ink`, truncated at the end, with the whole of what is shown in its title (a masked secret titles its mask, never the secret).
3. **Reveal** (secret only): an eye icon button that shows or hides the value.
4. **Copy**: a 32px icon button; after a copy it shows a check in `positive-ink` for 1.6s.

## Variants

| Variant | Use |
|---|---|
| Value | Public identifiers: a request ID, an endpoint URL |
| Secret | API keys, signing secrets: a word prefix of at most two parts (`zzm_live_`, `sk_test_`), never a part of the random value, then eight dots whatever the length, then the last 4 characters once the value has 16 or more; in an embed it stays masked and Reveal is not offered |

## Sizes

One size, `control-md`; it takes its container's width.

## States

| State | Spec |
|---|---|
| Rest | as above |
| Hover (buttons) | `fill-hover` behind the icon, icon `ink` |
| Focus (buttons) | the 2px `accent` focus ring |
| Copied | the Copy icon becomes a check in `positive-ink` for 1.6s; a polite live region says "API key copied" |
| Revealed | the full value; the eye becomes an eye with a slash |
| Not copied | the browser refused the write: the button stays Copy, the value is selected for the person to copy (a masked secret is shown first), and the live region says "Not copied: your browser did not let the page copy it. It is selected: copy it yourself." In an embed a secret stays masked and unselected, and the line says it is not shown here. Drawn by the browser's own selection, so the Atlas does not hold it still |

## Behaviour

- Copy writes the real value to the clipboard whether or not it is revealed.
- Feedback belongs to the latest Copy attempt: starting another attempt clears the previous result, and only the latest completion may confirm a copy or offer manual selection. Each success has its own 1.6s confirmation interval.
- Replacing the value resets confirmation, refusal and Reveal before the new value is drawn. Changing between public/secret or console/embed modes also starts fresh; a newly secret value never inherits a public field's visibility.
- The value itself is selectable text.

## Surfaces

- **Console** and **Mobile**: as specified; on phones the value truncates and the buttons keep their 32px targets.
- **Embed**: values only. A secret is never shown in an embed: the conversation is not a safe place to reveal it; the embed links to the console.

## Agents

An agent may read identifiers. It never receives a secret: views share masked values with the model, and Reveal is not offered on the embed surface.

## Accessibility

- The value is named by `label`; each button has its own name ("Copy API key", "Reveal API key").
- Contrast (light): value `ink` on `surface-sunk` above 16:1; icons `ink-3` 4.8:1.

## Content

Label the field with what it is: "API key", "Webhook signing secret".

## Do and do not

- Do mask every secret by default.
- Do not list a stored secret at all. An API key is shown in full once, when it is created; afterwards the page shows its hint (the prefix and the last four characters) as plain text, and the server never sends the secret again.
- Do not offer Copy for something that is not meant to be pasted elsewhere.

## Implementation

```tsx
import { CopyField } from '@/components/ui/copy-field';

<CopyField label="API key" value={key} secret />
```

Props: `value`, `label`, `secret`, `className`. The Atlas draws Copied and Revealed still with `data-preview-state` (`copied` or `revealed`), which holds the state rather than timing it; product fields take theirs from the buttons.
