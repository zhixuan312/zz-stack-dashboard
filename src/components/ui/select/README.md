# Select

A select is one choice from a list too long, or too wordy, for a Segmented control; its trigger looks like an Input and its list opens over the page.

Status: beta

## Anatomy

1. **Trigger**: the shared control frame with the current value (or a placeholder in `ink-3`) and a chevron.
2. **Leading icon** (optional).
3. **List**: `surface-raised`, `radius-lg` 16px, `shadow-overlay`, 4px inset; at least as wide as the trigger.
4. **Option**: 32px minimum, `text-sm`, an optional description line in `text-xs` `ink-3`, and a 16px `accent` check on the current choice.

## Sizes

The trigger takes Input's sizes: sm 32, md 38, lg 46px (compact 28, 32, 38). Options are 32px tall (taller with a description).

## States

| Part | State | Visual |
|---|---|---|
| Trigger | Rest, hover, invalid, disabled | as Input |
| Trigger | Focus (keyboard) or open | border `accent`; the accent ring on keyboard focus; the chevron turns 180° over `dur-hover` |
| Option | Highlighted | fill `fill-hover` |
| Option | Selected | the check |
| Option | Disabled | `ink-disabled`, skipped by the keyboard, still visible so the reader knows it exists |

The list enters with `float-in` (rises 4px and fades over `dur-enter`) and leaves over `dur-exit` 140ms.

## Behaviour

- In a native form (a server action), pass `name`: the control posts the chosen value through a hidden native input, so `formData.get(name)` reads it with no extra code.

- Opens on click, Enter, Space or the arrow keys; typing jumps to the first matching option; Escape closes and returns focus.
- The list flips above the trigger when there is no room below, and scrolls inside itself when it is taller than the window.

## Surfaces

- **Console**: as specified.
- **Mobile**: options are at least 44px tall on touch; the list is as wide as the trigger.
- **Embed**: allowed for a filter (a region, a model); the list stays inside the frame.

## Agents

Not applicable: a select is how a person chooses. An agent changing a saved choice proposes it.

## Accessibility

- Radix Select: the trigger is a combobox button; options are `role="option"` with `aria-selected`.
- Named by its Field or by `aria-label`. Value `ink` 18.1:1; descriptions `ink-3` on `surface-raised` 5.3:1; the check is a 3:1 mark.

## Content

- Option labels are short nouns; a description adds one fact that helps choose: "Ireland", "Matches the billing period".
- The placeholder names the choice: "Choose a model".

## Do and do not

- Do use Segmented for two to five short options that change a view.
- Do use a Radio group when every option needs a sentence to decide.
- Do not use a select for yes or no; that is a Switch or a Checkbox.

## Implementation

```tsx
import { Select } from '@/components/ui/select';

<Field label="Region">
  {(p) => <Select {...p} value={region} onValueChange={setRegion} options={[{ value: 'eu-west-1', label: 'eu-west-1', description: 'Ireland' }]} />}
</Field>
```

Props: `value`, `defaultValue`, `onValueChange`, `options` (`value`, `label`, `description`, `disabled`), `placeholder`, `size`, `leading`, `invalid`, `disabled`.
