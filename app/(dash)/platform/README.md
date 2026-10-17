# Status

How often real work called a tool the wrong way in the last whole week, read on the console's server: the Platform workspace's home.

## Structure

- Gate first: the page asks for `platform-status` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read. Every role holds `platform:read`, so a member and a superadmin both open it.
- Masthead: the kicker `ZZ Stack · Platform`, the title, one sentence, the as-of line, which is the read's own `meta.asOf` through the console's date formatter, and Ask beside it where the console has an assistant. The masthead is drawn before the read answers; the as-of line, Ask and the tile wait for it inside their own boundaries.
- One tile, `Malformed calls per 1,000`: the last whole week's rate to one decimal place, and on its one line the counts behind it and the week it is for, as `8 of 125 real-work calls, week of 5 Oct`. The info button says what the figure counts.
- Nothing else. The read also carries what needs attention, a scoreboard, the doors, the running versions and the team's own counts; the gateway answers them, and this page draws none of them and says nothing about them until it is rebuilt on them: no verdict, no list, no doors.

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

The assistant reads this page and changes nothing. The page shares its context through `platformStatusContext` in `src/views/platform-status-context.ts`, built from the same read and the same words as the tile, and `view_platform_status` builds the same context from the same response (`GET /platform/status`, reduced by `statusRead`), so the assistant quotes the figure the screen shows. Ask is in the masthead, beside the as-of line, because the tile is a Metric tile and has no head to hold it: what malformed calls per 1,000 in the tile's week say about how real work calls tools, or, with no whole week yet, why there is none to read.

### What the agent reads

The figure, its value to one decimal place, the counts and the week behind it, and what it counts. It says when a week has too few calls to compare, and that the page reads this one figure only, so nothing about what needs attention, the doors, the running versions or the team's own counts can be said from it. A read that failed or timed out is said to be so, with no figure.

```text
- Malformed calls per 1,000: 64.0, 8 of 125 real-work calls, week of 5 Oct. (Tool calls refused as malformed ...)
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address, and the page text after it for anything the context does not cover; `view_platform_status` answers the same text from anywhere in the console, and `explore_platform_status`, offered on this page alone, counts the platform's calls, refusals and malformed calls over any window, with the malformed calls per 1,000.

### What the agent does here

Protagonist: Malformed calls per 1,000.

- "How many malformed calls per 1,000 calls did real work make in the last 30 days?" — the malformed calls per 1,000 calls over 30 complete days
- "Which tool is called the wrong way most?" — the malformed calls over 30 complete days, by tool
- "Who are this week's refusals put down to?" — the refusals over 7 complete days, by owner

## Surfaces

Console, desktop and phone. Reads `GET /platform/status` on the console's server, as the person, once per request and bounded at 5 seconds. It declares no live collection: the figure is a whole week's, and the next visit reads it again.
