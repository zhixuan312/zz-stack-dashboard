# Incident card

An incident card tells an incident the way a reader needs it: what is affected, how bad it is, where it stands, and every update since it started, newest first.

Status: beta

## Anatomy

1. **Edge** (live only): a 2px line across the top in the state's colour.
2. **State badge**: "Investigating", "Monitoring" or "Resolved", with a dot.
3. **Severity badge**: "Minor" or "Major".
4. **Identifier**: the incident's id, `t-caption`, right-aligned.
5. **Title**: what is wrong, where: "Elevated latency on Inference API in eu-west-1", `t-card`.
6. **Meta line**: the service, when it started (relative to now, exact on hover), and how long it lasted once resolved, in `t-caption`.
7. **Owner and ticket** (optional, `card` only): a second caption line, "Owner Jonas Weber · Ticket Inference API p95 above target in eu-west-1". The owner is text in `ink-2`; the ticket is a link in `accent-ink`, named by the ticket's title. Either stands alone; with neither there is no line.
8. **Timeline**: every update, newest first: a dot, how long after the incident's start it came, as a caption in `t-caption`, medium, with tabular figures ("after 42m", "at the start"), then the text in `t-small`. The newest dot of a live incident pulses.

## Variants

| Variant | Use |
|---|---|
| `card` (default) | Each open incident on Now and on Services |
| `row` | A compact entry in a list of past incidents: title (wraps, never truncated), severity, service, date, how long it lasted, state word. It names no owner and no ticket |

## Sizes

| Part | Spec |
|---|---|
| Card | `radius-lg` 16px, `card-pad` padding, `line` border; a live incident's border takes its tone at 30% |
| Owner and ticket | `t-caption`, 4px under the meta line; a long ticket title wraps to a second line rather than losing its end |
| Timeline | 20px between updates; a 14px dot column; a 1px `line` joins the dots |
| Row | `card-pad` horizontally, 14px vertically; two lines |

## States

| State | Edge and border | Badge | Newest dot |
|---|---|---|---|
| Investigating | `critical` | critical, "Investigating" | `critical`, pulsing |
| Monitoring | `warning` | warning, "Monitoring" | `warning`, pulsing |
| Resolved | none | positive, "Resolved" | `ink-3`, still |

## Behaviour

- The card carries no actions of its own. Its one link is the ticket, when the incident has one; a page adds a link to the full incident where it has one.
- The head says when the incident started relative to `now` ("started 3 h ago"), with the exact time in the title attribute; past a fortnight it becomes a date.
- Each update is timed from the incident's start, not from now, in the product's durations (`formatDuration`): "after 42m", "after 1.1h", "after 2.6h". A reader of a timeline asks how long each step took, and this reading does not move as the clock does. The exact time stays in the title attribute.
- An update inside the first minute, or timed before the start, reads "at the start". A first update that came later says how long after: "after 4m".
- `afterStart(started, at)` lives in `src/logic/after-start.ts`: a page that times the updates in its own words, as Now's line under its title does, uses the logic layer's helper, so the two never differ.
- A hyphenated name of up to 24 characters, such as "eu-west-1", stays on one line in the title, in an update and in the ticket's title: a break after its hyphen reads as two words. The hyphen is a real one, so copying and find-in-page still match. A longer run of hyphens, such as a path, wraps as before.

## Composition

Card (Layer 2) with Badge, Status dot and text; the timeline is an ordered list. The `row` variant has no Card: it sits in a Card divided by hairlines.

## Data

| Field | Meaning |
|---|---|
| `state` | `investigating`, `monitoring` or `resolved` |
| `severity` | `minor` (degraded) or `major` (failing for some customers) |
| `started`, `resolved` | ISO times; the duration is `resolved - started` |
| `updates` | `{ at, text }`, written for customers, in any order: the card sorts them newest first and times each as `at` less `started` |
| `owner` | Optional. Who has the incident: a person's name, drawn as text |
| `ticket` | Optional. `{ title, href }`: the ticket the work is tracked in and its address inside the product |

A record may hold more than the card draws. The sample's `incidents` hold `owner`, a member's name or null, and `ticketId`, a ticket's id or null; `readIncidents()` in `src/data/metrics.ts` hands a page this shape: the owner by name and, where the person may read the ticket, `ticket` joined from the id as its title and the address the Tickets page finds it at (`/operations-tickets?q=<its title>`).

## Surfaces

- **Console**: the `card` on Now and for each open incident on Services; a `row` for each resolved incident on Services.
- **Mobile**: the cards stack under the services; the owner and the ticket wrap onto as many lines as they need. Nothing else changes.
- **Embed**: the inline Now view reduces a live incident to a warning Banner (title, state, started) with Ask; the card appears in fullscreen.

## Agents

An agent reads incidents through the shared context of Services and Now (title, service, severity, state, owner, ticket and latest update). Updates are written by people; an agent may draft one only as a Proposal.

## Accessibility

- The timeline is an ordered list labelled "Updates"; each time is a `<time>` element whose `datetime` is the update's own instant and whose text is the time since the start.
- The owner is plain text after the word "Owner". The ticket is a link named by the ticket's title, after the word "Ticket", and is the card's only Tab stop.
- State and severity are words, not colours alone.
- Contrast (dark, indigo): title `ink` 16.9:1; the meta line and each update's time `ink-3` 6.4:1; update text and the owner `ink-2` 8.0:1; the ticket's link `accent-ink` 9.5:1; badges 8.2:1 and up.

## Content

- The title names the symptom and the scope, never the cause: "Upload failures for files over 50 MB".
- Updates say what changed and what happens next, in the past tense for what was done: "Traffic shifted to eu-central-1. Latency is recovering."
- The owner is a person's name as the product shows it elsewhere: "Jonas Weber", never a handle or a team alias.
- The ticket is named by its own title, never by its id and never "View ticket".

## Do and do not

- Do keep every update; never edit an old one.
- Do say how long a resolved incident lasted.
- Do link the ticket to an address inside the product, so it opens where the work is tracked.
- Do not pass `owner` or `ticket` to a card customers read, such as a public status page: who has an incident and where its work is tracked are the team's.

## Implementation

```tsx
import { IncidentCard } from '@/components/patterns/incident-card';

<IncidentCard incident={current} now={DEMO_NOW} />
<IncidentCard incident={{ ...current, owner: 'Jonas Weber', ticket: { title: 'Inference API p95 above target in eu-west-1', href: '/operations-tickets?q=p95+above+target' } }} now={DEMO_NOW} />
<Card className="divide-y divide-line">{past.map((i) => <IncidentCard key={i.id} incident={i} now={DEMO_NOW} variant="row" />)}</Card>
```

Props: `incident`, `now` (the data's clock, which the head's "started 3 h ago" is read against), `variant`, `className`. `owner` and `ticket` are fields of the incident, not props of the card.
