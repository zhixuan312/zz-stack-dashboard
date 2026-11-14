# Uptime bars

Uptime bars show a service's recent days as one SVG, so an incident stands out from a run of healthy days.

Status: beta

## Anatomy

1. **SVG**: one `<svg role="img">` per strip, labelled by the summary. One baseline `<rect>` in the operational fill spans each stretch of days with data, so a period with data on every day has one; one `<rect data-day data-state>` is drawn per non-operational day. A focus rect appears only while a day is focused.
2. **Caption**: "90 days ago" (the span shown), a hairline, the uptime percentage in `ink-2`, a hairline, "Today", or the day the strip ends on when it is given `endLabel`.
3. **Tooltip**: on hover or keyboard focus, the day's state and date, on `surface-inverse`. Centred over the day mid-strip and flush with the figure's edge at either end, so a card that clips its content never cuts it.
4. **Screen-reader text**: one paragraph with the period and its uptime, then one sentence per degraded, outage or no-data day ("12 Sept 2026: Outage."), or "No incidents." There is no table of every day.

## Variants

| State of a day | Drawn as |
|---|---|
| Operational | The baseline: `positive` at 22%, so it recedes |
| Degraded | A `warning` mark |
| Outage | A `critical` mark |
| None | A `line-strong` mark with no baseline beneath it, so it never reads as up; read as "No data" and never counted as up |

`size="lg"` draws a 56px strip for one that leads its card (Now's days inside the band); the default is 32px. `measure` is the word after the percentage: "uptime" by default, "on time" or "in stock" for other domains. A strip of complete days ends on the latest of them, not today: it takes that day as `end` and names it in `endLabel` ("02 Oct 2026"), so the caption never calls yesterday "Today".

## Sizes

The viewBox is one unit per day, so the strip fills the container's width and every day is always drawn; a narrow container scales the drawing rather than dropping days or tightening gaps.

## States

| State | Spec |
|---|---|
| Hover or focus | A focus rect marks the day; the tooltip shows. |
| Short history | Fewer days than the window: the days widen to fill it; the caption's count says how many days there are. |
| No days | "No history yet" in `t-caption`; no plot, no caption and no period. |

## Behaviour

The strip is a focusable group: Arrow Left and Right, Home and End move the focused day, Escape clears it, and a polite live region announces its date and state.

The Atlas uses `data-preview-index` to draw a pointed day and its tooltip still; product strips take theirs from the pointer and the keys.

## Surfaces

- **Console**: 90 days.
- **Mobile** and **Embed**: every day, scaled to the width.

## Agents

The Services view shares each service's state and uptime as structured context; an agent names incidents by date from it.

## Accessibility

Every state has a word in the tooltip, the live region and the summary; colour is never the only signal. Status fills hold 3:1 on `surface` (positive 8.58:1 dark at full strength; warning 3.36:1 light).

## Content

Uptime is shown to at most three decimals at 99.99% and above and at most two below, never with a trailing zero ("99.994%", "99.81%", "100%").

## Do and do not

- Do pair it with the service's name and current status word.
- Do not use it for anything but day states.

## Implementation

```tsx
import { UptimeBars } from '@/components/charts/uptime-bars';

<UptimeBars label="Inference API over 90 days" days={service.days} uptime={service.uptime} end={DEMO_NOW} />
```
