# Combobox

One choice from a list of records — more than about fifteen, or loaded from a server — that a person finds by typing; a short fixed list is a Select.

Status: beta

## Anatomy

1. **Field**: the shared control frame with an input in it, the current label (or a placeholder in `ink-3`), and a chevron.
2. **Leading icon** (optional).
3. **List**: `surface-raised`, `radius-lg` 16px, `shadow-overlay`, 4px inset; as wide as the field, at most 288px tall, scrolling inside itself.
4. **Option**: 32px minimum, `text-sm`, an optional description line in `text-xs` `ink-3`, and a 16px `accent` check on the current choice.
5. **Custom row** (optional): the last row, "Use “ABC-123”", offering the typed text itself when `allowCustom` and the caller's `customPattern` accept it.
6. **Message**: the loading line, or "No match for “pri”" while nothing matches.

## Sizes

The field takes Input's sizes: sm 32, md 38, lg 46px (compact 28, 32, 38). Options are 32px tall (taller with a description).

## States

| Part | State | Visual |
|---|---|---|
| Field | Rest, hover, invalid, disabled | as Input |
| Field | Focus or open | border `accent`; the accent ring on keyboard focus; the chevron turns 180° over `dur-hover` |
| Option | Highlighted | fill `fill-hover` |
| Option | Selected | the check, `aria-selected` |
| Option | Disabled | `ink-disabled`, skipped by the keyboard, still visible so the reader knows it exists |
| List | Loading | a spinner and "Loading options…", never the empty line |
| List | No match | "No match for “…”" in `ink-3`, centred; the typed text stays |

The list enters with `float-in` (rises 4px and fades over `dur-enter`) and leaves over `dur-exit` 140ms.

## Behaviour

- **Type to narrow.** The filter and its rank are one function, `src/lib/rank.ts`, shared with the Command palette: a match where the query starts in the label comes first, then by the order given; a match in a description, in `keywords` or in a hint still finds the record and ranks after every label match.
- **The field keeps focus.** The list opens under it; the arrow keys move the highlight, Enter chooses it, Escape closes and restores the chosen label, Tab closes and moves on. `aria-activedescendant` names the highlighted row, so the list is never focused.
- **Opening does not filter.** The chosen label is selected in the field, so opening shows the whole list and typing replaces the label rather than searching for it.
- **Async options.** Pass `loading` while they arrive: the list waits with its reason. When they land, the same query filters them; an option list that changes under an open list keeps its query.
- **A custom value.** With `allowCustom`, text that no option is (and that `customPattern`, when given, accepts) gets a trailing row; choosing it calls `onValueChange` with the text. Text outside the pattern is not offered, and the Field's hint should say the shape.
- **In a native form (a server action)**, pass `name`: the chosen value posts through a hidden input, so `formData.get(name)` reads it.

## Surfaces

- **Console**: as specified.
- **Mobile**: options are at least 44px tall on touch; the list is as wide as the field.
- **Embed**: allowed for a filter over records (a person, a ticket); the list stays inside the frame.

## Agents

Not applicable: a combobox is how a person chooses. An agent changing a saved choice proposes it.

## Accessibility

- The input is `role="combobox"` with `aria-expanded`, `aria-controls` (while open) and `aria-activedescendant`; the list is `role="listbox"`; each row is `role="option"` with `aria-selected` and `aria-disabled`.
- Focus never leaves the field: the rows are moved over with the arrow keys, and a press on a row picks it without taking focus, so the list cannot close before the pick lands.
- An input method composing (Chinese, Japanese, Korean) owns Enter, Escape and the arrows until it is done.
- Named by its Field or by `aria-label`. Value `ink` 18.1:1; descriptions `ink-3` on `surface-raised` 5.3:1; the check is a 3:1 mark.

## Content

- Option labels are the record's own name ("Amara Okafor"), not its id.
- The description adds one fact that tells two records apart: the team and role, or the address.
- The placeholder names the search: "Find a person".

## Do and do not

- Do use Combobox when the options are records — each with a description — when there are more than about fifteen, or when the list is loaded from a server.
- Do use Select for a short, fixed list (a priority, a region, a retention period): it opens with every option in view and needs no typing.
- Do use Segmented for two to five short options that change a view, and a Radio group when every option needs a sentence to decide.
- Do not use a combobox for yes or no; that is a Switch or a Checkbox.

## Implementation

```tsx
import { Field } from '@/components/ui/field';
import { Combobox } from '@/components/ui/combobox';

<Field label="Assignee" hint="Everyone in the workspace, or leave it unassigned.">
  {(p) => (
    <Combobox
      {...p}
      value={assigneeId ?? 'nobody'}
      onValueChange={(id) => setAssigneeId(id === 'nobody' ? null : id)}
      options={[{ value: 'nobody', label: 'Nobody' }, ...people.map((x) => ({ value: x.id, label: x.name, description: `${x.team} · ${x.role}` }))]}
      placeholder="Find a person"
    />
  )}
</Field>
```

A custom value, with the shape it must have:

```tsx
<Combobox allowCustom customPattern={/^[A-Z]{3}-\d{3}$/} options={codes} onValueChange={setCode} aria-label="Reference" />
```

Props: `value`, `defaultValue`, `onValueChange`, `options` (`value`, `label`, `description`, `keywords`, `disabled`), `placeholder`, `size`, `leading`, `invalid`, `disabled`, `loading`, `allowCustom`, `customPattern`, `name`.
