# Empty state

An empty state is what a view shows when it has nothing to show, and why: never created, filtered to nothing, failed to load, or not permitted. Each offers the one action that changes it.

Status: beta

## Anatomy

1. **Disc**: the icon (20px) on a soft circle (48px), with two faint rings around it in the centred layout. The error kind's mark is a triangle and the no-access kind's a lock.
2. **Title**: what is empty, said plainly (`t-card`).
3. **Sentence** (optional): what to do or what happens next (`t-small`, `ink-2`).
4. **Action** (optional): one button.

## Variants

| Kind | Disc | Use | Action |
|---|---|---|---|
| First run | `accent-tint`, `accent-ink` | Nothing has been created yet | Create the first one |
| Filtered | `fill-track`, `ink-3` | Records exist but the filters hide them | Clear filters |
| Error | `critical-tint`, `critical-ink` | Loading failed | Retry |
| No access | `fill-track`, `ink-3` | The person's role may not open this page | None; ask an Owner or Admin |

## Sizes

| Layout | Use | Spec |
|---|---|---|
| Centred | A whole card or page body | 56px vertical padding; the title 32px under the disc; text at most 384px wide |
| Inline | In a list, where rows would be | A 36px disc beside one or two lines, the action at the end, or on a line of its own where the row has no room for it |

## States

The empty state is itself a state of a list, a table or a chart. It replaces the content, not the card: the card keeps its head and its size in the row.

No access replaces the whole page body instead: a page returns it before it reads anything, so the protected records never load at all.

## Behaviour

- Filtered names the filters in the sentence and clears them all with one action.
- Error says what failed (the service, the timeout), keeps the reader's filters, and retries the same request.
- No access names the feature and the roles whose own grants satisfy the whole need, read off the role table (`whoCan`), so editing the grants edits every sentence. When no single role satisfies the need, the sentence says it takes a main role together with an add-on, and names no role that would not suffice alone.
- A product's own art (a mascot, an illustration) replaces the disc on every centred empty state, the ones a Data table draws inside itself included: wrap the app once in `<EmptyStateArt value={{ 'first-run': …, filtered: …, error: … }}>`. An `icon` passed to one empty state still wins; inline empty states keep the disc, since art at 36px is a smudge.

## Surfaces

- **Console**: centred in cards, inline in lists.
- **Mobile**: the same; the text wraps to the narrower measure.
- **Embed**: inline only; an embed has no room for the centred layout.

## Agents

When an agent's query finds nothing, the view shows the filtered state with the agent's filters named, so the person can see what was asked.

## Accessibility

- The error kind is `role="alert"`.
- No access is not an alert: nothing failed. Its root carries `data-no-access`, and the title and sentence carry the meaning.
- Every kind's root carries `data-empty` with its kind. The navigation diagnostic reads `data-empty="first-run"` as data that arrived empty, and `data-empty="error"` as data that failed, so an empty list is not reported as a page that never got ready. A product's own empty state carries the same attribute.
- The disc is decorative; the title carries the meaning.
- Title `ink` on `surface` 18.5:1; sentence `ink-2` 7.1:1 (light, cobalt).

## Content

- First run: "No API keys yet". Filtered: "No requests match these filters". Error: "Requests did not load".
- No access: "You don't have access to API keys" over "Owners, Admins, Members and Key managers can open it. Ask an Owner or Admin for access." Both are generated: the title from the feature's own title, the sentence from the role table.
- Never "Oops", never an apology, never "Something went wrong".

## Do and do not

- Do distinguish the four kinds; "nothing yet", "nothing matches" and "not permitted" ask for different actions.
- Do not leave a card blank while its data is empty.

## Implementation

```tsx
import { EmptyState } from '@/components/ui/empty-state';

<EmptyState kind="filtered" title="No requests match these filters" action={<Button onClick={clear}>Clear filters</Button>}>
  Status 5xx and customer Northwind Labs found nothing in the last 7 days.
</EmptyState>
```
