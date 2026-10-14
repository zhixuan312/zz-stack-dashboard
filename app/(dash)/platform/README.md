# Status

How often real work called a tool the wrong way in the last whole week, read on the console's server: the Platform workspace's home.

## Structure

- Gate first: the page asks for `platform-status` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read. Every role holds `platform:read`, so a member and a superadmin both open it.
- Masthead: the kicker `ZZ Stack · Platform`, the title, one sentence, and the as-of line, which is the read's own `meta.asOf` through the console's date formatter. The masthead is drawn before the read answers; the as-of line and the tile wait for it inside their own boundaries.
- One tile, `Malformed calls per 1,000`: the last whole week's rate to one decimal place, and on its one line the counts behind it and the week it is for, as `8 of 125 real-work calls, week of 5 Oct`. The info button says what the figure counts.
- Nothing else. The read also carries what needs attention, a scoreboard, the doors, the running versions and the team's own counts; the platform marks those unavailable for now, and the page draws none of them and says nothing about them: no verdict, no list, no doors.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx` while the gate asks `/me`, then the masthead over one tile skeleton while the read is under way |
| Default | The rate, its counts and its week |
| Too few calls | The rate and its counts, with `Too few calls to compare` under them |
| No calls that week | `No calls that week` in the figure's place, the week on the line under it, and no number |
| Figure unavailable | `Unavailable`, and the week it was not worked out for |
| No whole week yet | `No whole week yet`, with no line under it |
| Read failed | The template's error state: "The platform's status did not load", with Retry, which reads again on the server |
| Measure missing | The same error state: "The platform's status did not include this figure", with Retry |
| Slower than 5 seconds | The bounded unavailable state: "The platform's status is unavailable" and that it did not answer within 5 seconds, with Retry; never an endless skeleton |

## Agents

The assistant reads this page and changes nothing. The page shares its context through `platformStatusContext` in `src/views/platform-status-context.ts`, built from the same read and the same words as the tile, so the assistant quotes the figure the screen shows.

### What the agent reads

The figure, its value to one decimal place, the counts and the week behind it, and what it counts. It says when a week has too few calls to compare, and that the page reads this one figure only, so nothing about what needs attention, the doors, the running versions or the team's own counts can be said from it. A read that failed or timed out is said to be so, with no figure.

```text
- Malformed calls per 1,000: 64.0, 8 of 125 real-work calls, week of 5 Oct. (Tool calls refused as malformed ...)
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address, and the page text after it for anything the context does not cover.

## Surfaces

Console, desktop and phone. Reads `GET /platform/status` on the console's server, as the person, once per request and bounded at 5 seconds. It declares no live collection: the figure is a whole week's, and the next visit reads it again.
