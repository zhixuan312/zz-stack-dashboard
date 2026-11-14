# Form section

A form section is a titled group of settings that saves on its own: its title and purpose on the left, its fields in a card on the right, and a save bar that appears the moment something changes.

Status: beta

## Anatomy

1. **Head**: the title (`t-card`) and one or two sentences (`t-small`, `ink-2`) saying what these settings change, for whom.
2. **Actions** (`actions`, optional): beside the title, at its end, on the title's row at every width, a phone's included; the description stands under the row. The same contract as a Card header's actions: on a settings page, Ask about, in the first section's.
3. **Card**: the fields, 20px apart, in a `surface` card with a `line` border.
4. **Error banner** (when a save needs attention): a critical Banner above the fields. It does not claim the save failed: a missing response can follow a committed change.
5. **Read-only notice** (`readOnly`, when the reader cannot change it): a lock and the words "Read-only". It never says who can change the section: a read-only page offers no control it withholds and says nothing about who holds it.
6. **Save bar** (with `onSave`, when dirty): "Draft changes", Discard (ghost) and Save changes (primary), pinned to the bottom of the view while the section is on screen.
7. **Footnote** (optional): a caption under the card: "Changes apply at once".
8. **Setting row** (`SettingRow`): for a control that is not a text field, its label and description on the left and the control on the right.

## Variants

| Variant | How | Use |
|---|---|---|
| Saves on its own | `onSave`, `onDiscard`, `dirty` | Text fields, selects: anything that should not apply on each keystroke |
| Applies at once | no `onSave` | Switches and segmented controls; add a footnote that says so |
| With actions | `actions` | A control about the whole section beside its title: Ask about on a settings page |
| Danger zone | `tone="critical"` | Irreversible actions; the title and border take the critical tone |
| Layout only | `as="div"` | The same head and card with no `<form>` around them: a card holding a table that runs edge to edge (tokens, people, members), or a form of its own, since forms cannot nest. Nothing submits, so there is no save bar — its children save themselves |
| Layout only, flush | `as="div" flush` | The table runs to the card's edges; the card clips it and drops its header row's top border, so the card's edge is the table's edge |

## Sizes

| Part | Spec |
|---|---|
| Layout | Two columns from 48rem of section width: 15rem head, the card fills up to `field-width`; one column below |
| Gap | 40px between the columns, 20px between head and card when stacked |
| Actions | 16px from the title, at the top of its row; controls 6px apart, as a Card header's |
| Card | `radius-lg` 16px, `card-pad` padding, `shadow-card` |
| Save bar | `surface-raised` at 90% with a backdrop blur, `line` top border, small buttons |

## States

| State | What shows |
|---|---|
| Clean | Fields only |
| Dirty | The save bar opens (rows grow from 0 over `dur-enter`, `ease-out`) |
| Saving | Fields disabled; Save shows its busy spinner; Discard disabled |
| Saved | The bar closes; a toast confirms ("Workspace saved") |
| Error | The bar stays; a critical Banner above the fields says why and what to do |
| Read-only | Fields disabled, their values kept legible in `ink-2` (the reader came to read them); the notice reads "Read-only" beside the lock, and nothing names a role or a person who could change them |

## Behaviour

- Enter in a field submits the section when it is dirty; nothing else on the page saves.
- Discard restores the saved values. Leaving with unsaved changes asks first: while `dirty` is true the section tells the shell (`useUnsavedChanges`), and following a link, a menu or palette destination or a table row asks "Leave without saving?" (Stay or Leave); closing the tab gets the browser's own warning. Saving or discarding stops the asking at once, and outside a shell nothing is asked.
- A field's own validation error (Field `error`) shows under the field without a banner; the page withholds `onSave`, or keeps `dirty` false, while a field is invalid, since the section saves whenever Save is pressed. The banner is for a server refusal or an unconfirmed request. Preserve the draft on either; after a missing response, check the latest records before retrying rather than claiming nothing changed.

## Composition

A form element holding a fieldset, or — with `as="div"` — a plain element holding a div; Field, Input, Select, Switch and Segmented from Layer 2; Table when the section holds one; Banner for errors; Button for the save bar; Toast for confirmation; whatever `actions` holds, Ask about on a settings page. Settings pages stack sections 56px apart on a form page (`form-width`), which fills the canvas until it is wider than a form needs and then centres.

`SettingRow` is a section's own child and needs nothing from `FormSection`: with `as="div"` and no `onSave`, a switch that applies the moment it is flipped sits in the same layout, saving itself.

## Data

The section holds no values: the page owns them, compares them with its last confirmed record to set `dirty`, and performs the save in `onSave`. A missing response can follow a commit, so the bar and leave warning describe the local draft rather than asserting it was not saved.

## Surfaces

- **Console**: two columns on a form page; the card stops at `field-width`, so a field never stretches across a wide screen.
- **Mobile**: one column; the save bar spans the width above the safe area.
- **Embed**: not offered. Settings belong to the console; an agent proposes a setting change as a Proposal instead.

## Agents

An agent never edits a form section. A change it wants (a rate limit, a notification) arrives as a Proposal that names the setting, its value before and after, and why. The "Agents and MCP" section on Settings shows that approval is always required, locked on. Ask about in a section's `actions` hands the page to the assistant to ask about, never to change.

## Accessibility

- A real `<form>` with a `fieldset`; disabling the fieldset disables every control at once and says so to assistive technology.
- The save bar's buttons leave the tab order when the bar is closed.
- The error banner has `role="alert"`.
- Contrast (dark, indigo): head text `ink-2` 8.0:1; critical title `critical-ink` 9.6:1; primary label 5.0:1.

## Content

- Titles are nouns for what is configured: "Workspace", "Notifications". The description says what changes for whom.
- The save button says what it saves when it is not obvious ("Save workspace"); "Save changes" otherwise.
- A danger action names the object: "Delete workspace", and its confirmation asks for the workspace's address typed out.

## Do and do not

- Do give each section its own save; one Save at the bottom of a long page loses edits.
- Do use switches only where the change applies at once.
- Do not mix instant switches and saved fields in one section.

## Implementation

```tsx
import { FormSection, SettingRow } from '@/components/patterns/form-section';

<FormSection title="Workspace" description="How this workspace is named." dirty={dirty} saving={saving} onSave={save} onDiscard={reset}
  actions={<AskAbout question="What do these settings change for this workspace?" />}>
  <Field label="Name">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
</FormSection>
```
