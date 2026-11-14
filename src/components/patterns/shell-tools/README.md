# Shell tools

The shell tools are the global controls in the top bar of every console page, search and commands (⌘K) and alerts, kept one press away while the page scrolls.

Status: beta

## Anatomy

1. **Search pill**: a 36px pill with a search icon, the word Search and the palette's key, ⌘K on an Apple keyboard and Ctrl K on any other (`usePaletteKey()`); it opens the Command palette.
2. **Alerts**: a 36px round button with a bell and, when something is new, an 8px `accent` dot ringed in `ground`. It opens the alerts panel.
3. **Alerts panel**: a 352px popover, aligned to the bell's end: a head ("Alerts", the new count, Mark all read), then one row per alert (a status dot, the title, one line of detail, the time), each a link to where the alert is handled. Empty: "Nothing needs you right now."

## Composition

Kbd, Popover and Status dot, placed by `AppShell` in `PageFrame`'s top bar through the `tools` prop. Both controls are glass: `surface` at 60% with `backdrop-blur-md`, a `line-strong` hairline and `shadow-control`.

## States

| State | Search pill | Alerts |
|---|---|---|
| Rest | text `ink-3` | icon `ink-2` |
| Hover | border `line-control` at 40%, text `ink-2` | icon `ink` |
| Pressed | `press`: 0.5px down, 98.5% | same |
| Focus | 2px `accent` outline | same |
| New alerts | — | the dot; the name says how many |
| Open | — | icon `ink`; the panel floats in over `dur-enter` |
| An alert opened | — | it is read: its title drops to `ink-2`, its dot stops breathing, the count falls |

The top bar itself is clear at rest and turns to glass (`ground` at 72%, `backdrop-blur-xl`, a `line` hairline) once the page title scrolls out, over `dur-enter`.

## Data

- `alerts`: `{ id, title, detail?, at, href, tone, unread? }[]`: what needs a person, where they act on it. The live incident leads. Each alert's dot names its tone in words (`TONE_WORD`), since no word beside it says what kind of thing it is. An alert may name its `group` — "Incidents", "Verifications" — and the panel then draws one heading per kind, in the order the kinds first appear, each with its own unread count ("Incidents · 1 new"). The bell's own name still states the total, and Mark all read still covers the panel. A product works them out from reads, never types them: the sample's `readAlerts()` in `src/logic/alerts.ts` tells each unresolved incident, the customers past due in one alert (by name when there is one), how many verifications are failing and each high-priority ticket nobody has, by the same functions its pages use, and links each to the page that handles it. A kind that cannot be read is left out; a person with no session is told nothing. The layout passes the read's promise to a component that resolves it behind its own boundary, so the shell does not wait; until it settles, and when it fails, the tools are drawn with no alert.
- `now`: required, the data's clock (the time of the read that told the alerts, so no alert is later than it) and never the browser's, so "36 min ago" reads the same on the server and in the browser.
- Read state is kept for the session: the ids of the alerts opened in this tab are in session storage under `<slug>.alerts-read`, so a reload keeps them read. Wire it to your store to keep it across tabs and visits.

## Surfaces

- **Console**: the pill shows "Search" and ⌘K.
- **Mobile**: when the top bar itself is under 40rem (a phone, or a canvas the assistant column has narrowed), the pill folds to its 36px icon and the key hint goes; the bar is a container, so the window width does not decide it.
- **Embed**: absent.

## Agents

Not applicable.

## Accessibility

- The pill's name is its text; the alerts button is named with its count ("Alerts, 1 new").
- The dot is never the only signal: the name carries the count.

## Content

- The tooltip names the control and the count: "Alerts, 1 new".

## Do and do not

- Do keep the top bar to these global tools. Page actions live in the masthead.
- Do not add a third tool without removing one; the bar holds two at phone width.
- Do link every alert to the page that handles it; an alert with nowhere to go is a toast.

## Implementation

```tsx
import { ShellTools } from '@/components/patterns/shell-tools';

<AppShell rail={<Rail nav={nav} />} tools={<ShellTools alerts={alerts} now={updatedAt} />}>{children}</AppShell>
```
