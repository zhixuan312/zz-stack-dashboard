# Status list

A status list shows every service and how it is right now, with ninety days of history, so a reader learns in one line whether anything is wrong and in one glance where.

Status: beta

## Anatomy

1. **Summary line** (optional): a status dot and the worst state among the services, in words: "All services operational", "1 service degraded", "1 service is down". The count of services on the right from 28rem of card width.
2. **Service row**, one per service:
   1. **Dot and name**: a 8px status dot and the service name, `text-sm` medium.
   2. **Description** (optional): in `t-caption`, wrapping to a second line rather than losing its end.
   3. **Uptime bars**: the service's days, oldest on the left (the Uptime bars card).
   4. **Run** (optional): one line under the bars, in `t-caption`, saying how long the service has been operational: "Operational for 69 days · its longest in 90". The figure is `ink-2`, medium; the words around it are `ink-3`.
   5. **State and latency**: the state word in its tone's ink, and `p95` latency in `t-caption`, right-aligned.

## Variants

| Variant | Prop | Use |
|---|---|---|
| With summary (default) | `summary` | A list that stands alone: an embed, a card without its own title |
| Without summary | `summary={false}` | Under a Card header that already says what the summary would |
| Without descriptions | `descriptions={false}` | Inline embeds and narrow cards, where one line per service is enough |
| With runs | `run` | A page about the services as they are now: each row says how long the service has been operational |

## Sizes

| Part | Spec |
|---|---|
| Row padding | `card-pad` horizontally, `space-4` 16px vertically; divided by `line` hairlines |
| Wide row (card at least 42rem) | Three columns: name 12 to 15rem, bars fill, state 5.5rem |
| Narrow row (under 42rem) | Name and state on one line; the bars on a second line across the full width |
| Run | `t-caption`, 8px under the bars' caption, across the bars' own width at every step: beside the name on a wide row, the row's full width on a narrow one. It wraps to a second line before it is cut |
| Summary | `text-md` 16px semibold, tracked -0.012em; a 10px dot |

## States

| State | Summary | Row |
|---|---|---|
| All operational | Dot `positive`, still; text `ink` | Dot `positive`; word "Operational" in `positive-ink` |
| Degraded | Dot `warning`, pulsing; text `warning-ink` | Dot `warning`, pulsing; word "Degraded" in `warning-ink` |
| Outage | Dot `critical`, pulsing; text `critical-ink` | Dot `critical`, pulsing; word "Down" in `critical-ink`, the word the summary and the run use for a service that is not up now ("Outage" is the Uptime bars' word for a day's mark) |
| Hover on a bar | | The Uptime bars tooltip names the day and its state |

The worst state wins the summary. Each service that is not operational pulses its dot; the pulse stops under reduced motion.

With `run`, a row reads one of these under its bars:

| The service's days | The row says |
|---|---|
| Operational today, and a longer run of operational days is among the days kept | "Operational for 40 days" ("1 day" for one) |
| Operational today after a day with a mark, and no run among the days kept is longer | "Operational for 69 days · its longest in 90" |
| Operational on every day kept | "Operational for at least 90 days", and never "its longest" |
| Degraded today | "Degraded today" |
| An outage today | "Down today" |
| No days | Nothing |

## Behaviour

- Rows are not interactive; the page around them links to the incident. Pointing at a bar reads its day.
- The list never scrolls on its own and never sorts: services keep the order the product defines, so a reader finds a service where it was yesterday.
- A run is never cut and never moves the bars: it takes a line of its own under them, so the strip keeps its place and its width with `run` on or off.

## Composition

A Card (`overflow-hidden`) holding: the summary line, then one row per service. Each row composes Status dot (Layer 2), the service text, Uptime bars (Layer 3) and the state text. On Services the summary follows the Card header "Each service, 90 days".

## Data

| Field | Meaning |
|---|---|
| `status` | The state now: `operational`, `degraded` or `outage` |
| `uptime` | Share of the period the service answered within its objective, as a fraction; shown to two decimals, or three at 99.99% and above. It must agree with `days`: 1 only when no day carries a mark |
| `latency` | p95 over the last hour, in milliseconds |
| `days` | One state per day, oldest first, ending today: the worst state of that day |

A run is the operational days in a row that end today, today included, counted from `days` by `runOf` in `src/lib/facts.ts`, so the figure and the strip above it are the same days. Today is the last day of `days`, whatever `status` says of this minute. The number after "its longest in" is how many days the service keeps. A run an earlier run only equals is still its longest: only a longer one takes the words away. A run that goes back to the earliest day kept is at least that long, because what came before is not known, and is never called the longest.

The list names its rows `item` by default ("All items operational"). Pass `noun` (`{ one: 'service', other: 'services' }`, `{ one: 'warehouse', other: 'warehouses' }`, sites, branches) for the summary and the count, `measure` for the word after each row's percentage ("on time"), and `metric` for the figure under the state word (default `p95 <latency>`).

## Surfaces

- **Console**: wide rows on Services and Now, with the summary and each service's run.
- **Mobile**: narrow rows; the bars drop under the name and still show every day, and a run keeps its line under them.
- **Embed**: the inline Now view shows the list with its summary and without descriptions, under a Banner for any live incident.

## Agents

An embed that shows this list shares the summary, the affected services and the open incident with the model (`useShareView`), so "is anything wrong?" has an answer without a tool call. An agent reads the list; it cannot change a service's state.

## Accessibility

- The summary has `role="status"`, so a change of state is announced.
- State is said in words beside every dot; colour repeats it, never carries it alone.
- Contrast (dark, indigo): `ink` on `surface` 16.9:1; state words: `positive-ink` 11.8:1, `warning-ink` 12.0:1, `critical-ink` 9.5:1; dots against `surface`: positive 8.6:1, warning 9.1:1, critical 5.9:1.
- Each Uptime bars figure carries a screen-reader sentence, and one more for each day that has a mark.
- A run is a sentence of text in its row, read after the strip it counts; nothing about it is carried by colour. Its words are `ink-3` 6.4:1 and its figure `ink-2` 8.0:1.

## Content

- Service names are what customers call them ("Inference API"), not internal names ("infer-gw-2").
- One description line says what the service does, not how: "Messages, completions and tools".
- The summary counts, then names the state: "1 service degraded", never "Partial degradation".
- A run is a count of whole days, said as a figure: "Operational for 69 days", never "No incidents for over two months".

## Do and do not

- Do keep the services in a fixed order.
- Do pair every degraded or down row with an incident somewhere on the page.
- Do not colour the whole row; the dot and the word are enough. A run is ink, in every state.
- Do not show percentages to more than three decimals.

## Implementation

```tsx
import { StatusList } from '@/components/patterns/status-list';

<Card className="overflow-hidden">
  <StatusList services={SERVICES} end={DEMO_NOW} />
</Card>
<Card className="overflow-hidden">
  <StatusList run services={SERVICES} end={DEMO_NOW} />
</Card>
```

Props: `services`, `end` (today), `summary`, `descriptions`, `run`, `noun`, `measure`, `metric`, `className`. `summarise(services, noun)` (from `src/logic/summarise.ts`, safe on the server) returns the worst state and its sentence for a page's own summary.
