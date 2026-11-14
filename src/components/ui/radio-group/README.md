# Radio group

A radio group is one choice from two to five options that each need a sentence to decide; every option stays visible, so the reader compares them in place.

Status: beta

## Anatomy

1. **Dot**: 16px circle, 1px `line-control` on `surface`; the hit area extends 8px.
2. **Indicator**: a 6px `on-accent` dot on an `accent` fill when chosen.
3. **Label**: `text-sm` `ink`.
4. **Description** (optional): `text-xs` `ink-3` (`ink-2` in cards). It describes the control (`aria-describedby`); the label alone names it.
5. **Card** (cards variant): the whole option is a bordered card, `radius-lg`, 14px padding (3.5 steps of the 4px scale).

## Variants

| Variant | Use | Layout |
|---|---|---|
| List (default) | Options inside a form | Stacked, 12px apart |
| Cards | The choice is the main decision of the form: a plan, a retention period | A grid of cards, at least 12rem each |

## States

| State | List | Cards |
|---|---|---|
| Rest | outline `line-control` | border `line`, `shadow-control` |
| Hover | outline `ink-3` | border `line-strong` |
| Chosen | fill `accent`, dot pops in with `ease-spring` | border `accent` doubled inside, fill `accent-tint` at 50% |
| Focus (keyboard) | 2px `accent` outline on the dot | same |
| Disabled | fill `surface-sunk`, label `ink-disabled` | the card at 55% opacity |

## Behaviour

- The arrow keys move the choice; Tab enters and leaves the group as one stop.
- One option is chosen by default when there is a sensible default; otherwise none is, and the form says so on submit.

## Surfaces

- **Console**: as specified.
- **Mobile**: cards stack one per row; each card is the target.
- **Embed**: not offered.

## Agents

Not applicable: the choice is a person's. An agent recommending an option proposes it, naming the option and why.

## Accessibility

- Radix RadioGroup: `role="radiogroup"` named by `aria-label` or its Field; options are `role="radio"`.
- `line-control` 3:1 on `surface` in every theme; the chosen state does not rely on colour alone (the dot appears).

## Content

- Labels are the option's name; descriptions say the consequence: "Matches the billing period", "Costs $0.02 per million requests".

## Do and do not

- Do keep options to five; more is a Select.
- Do not use a radio group for an instant view switch; that is Segmented.

## Implementation

```tsx
import { RadioGroup } from '@/components/ui/radio-group';

<RadioGroup aria-label="Log retention" value={days} onValueChange={setDays} options={[{ value: '30', label: '30 days', description: 'Matches the billing period.' }]} />
```

Props: `options` (`value`, `label`, `description`, `disabled`), `variant` (`list` | `cards`), and the Radix RadioGroup root props.

**Accent swatches.** `AccentSwatches` is the same radio group drawn as a row of colour circles, for the accent picker: one Tab stop, arrow keys move the choice, each swatch is named by its accent. The product's `data-accent` rule paints each one, so it names no colour itself. Props: `value`, `onChange`, `accents`, `size` (`sm` for a toolbar, `md` for a form), `label` (default "Accent").

```tsx
<AccentSwatches value={accent} onChange={setAccent} accents={ACCENTS} />
```
