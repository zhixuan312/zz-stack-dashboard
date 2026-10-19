# Status

What needs attention on the platform, how real work called its tools week by week, each door's days and what is running, read on the console's server: the Platform workspace's home.

## Structure

- Gate first: the page asks for `platform-status` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read. Every role holds `platform:read`, so a member and a superadmin both open it. Its title is `gatedMetadata`'s; its loading state (`OfferedLoading`) is headed Status for a person whose rail offers it, at `/platform` alone, and keeps `gatedLoading`'s words for anyone else.
- Masthead: the kicker `ZZ Stack · Platform`, the title, one static sentence, and the as-of line, the read's own `meta.asOf` through the console's date formatter. The masthead is drawn before the read answers; the as-of line and the page wait for it inside their own boundaries.
- What needs attention: a Panel titled with the gateway's headline for the reader (`6 things need you` for the superadmin, `6 things are known and open` for a member, `Nothing needs you` or `No known open issues` when every check found nothing, `N known issues; some checks unavailable` or `Status checks unavailable` otherwise). At most five rows, each with its tone's dot, its title, its detail and since when; a row links only where the gateway gives it a destination. The foot counts the instances shown, what overflowed by kind and which checks did not answer: `5 shown. 1 more not shown: approvals 1.`
- The paired figures: one Featured metric of two halves, `Malformed calls per 1,000` and `Refusals put right`, each its last whole week, by week as a Column chart (a week with no data keeps its place and is drawn as none, the running week unfinished), with its counts as the caption and the gateway's finding. Ask is in the card's head. The foot: the best week for malformed calls, the days in a row with work (`records.daysWithWork`) and every door's tool failures summed with their calls.
- The reader's own team: three Metric tiles, its malformed calls per 1,000, its refusals put right and its sessions, each its last whole week with its counts and its weeks' shape, and under them one line of its bug reports by how they stand.
- The scoreboard: a table of the five measures with a direction under `N of 5 measures are better than the week before`, the count of the gateway's `improved` judgements, and apart, a table of the three activity measures, which are never counted better or worse. Each row: its first comparable week, its best (activity: its high and low), its last whole week, the change on the week before and a Sparkline of its whole weeks. A rate changes in its per-1,000 unit, a share in points, a duration in milliseconds and a count in percent; a count from a week of none changes by the absolute count, never a percentage. Weeks that do not compare read `Not comparable`, and two that read alike `Unchanged`.
- The doors: a table, one row a door: a Sparkline of its daily tool-failure rate over the whole days that had calls (`Not enough days` under two), its days with calls, its fault days, its last fault day (`None recorded` when it has none), the gateway's run sentence, and today apart, so far.
- What is running: a Key value of the platform's and the console's versions, when it was released, the release before it and the migrations applied; `Unrecorded` when no release on record names the running version.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx` while the gate asks `/me`, headed Status for a person whose rail offers it, then the masthead over the page's shape (the list, the paired figures, three tiles, a table) while the read is under way |
| Default | Every part, from the read |
| Empty | A fresh platform: `Nothing needs you`, the paired figures with no whole week yet and every week drawn as none, the tables' rows with no data, and `No door has recorded a call` |
| Partial | A part the gateway answered `unavailable` draws its own unavailable state (the doors, the team's own counts, what is running) and the rest stands; a foot figure it fed reads `Unavailable`; a check that did not answer is named in the list's foot, and the headline never says nothing is open |
| Read failed | The template's error state: "The platform's status did not load", with Retry, which reads again on the server |
| Slower than 4.5 seconds | The bounded unavailable state: "The platform's status is unavailable" and that it did not answer within 4.5 seconds, with Retry; never an endless skeleton |

No figure claims a door could be reached: a fault day counts recorded tool failures, and the page prints no state word for a door. Days with work and sessions are agents' activity, never a person's hours.

## Agents

The assistant reads this page and changes nothing. The page shares its context through `platformStatusContext` in `src/views/platform-status-context.ts`, built from the same read and the same words as the page, and `view_platform_status` builds the same context from the same response (`GET /platform/status`, reduced by `statusRead`), so the assistant quotes the figures the screen shows.

### What the agent reads

The headline and the foot of what needs attention, each row's title as an insight with its destination where it has one, then the gateway's findings, which are the first to go when the context is over its budget; each of the eight measures with its last whole week, its change on the week before and its best (with its first week) or its high and low, the two paired figures with their counts; how many of the five directional measures are better; each door's fault days, days with calls, last fault day, run sentence and today so far; the days in a row with work and the tool failures with their calls; what is running; and the reader's own team's three figures and bug reports. It says what the values cannot say: that a fault day says nothing about whether a door could be reached, that activity measures are never better or worse, that a week too small is not compared and a missing week is not a zero, and which parts could not be read. A read that failed or timed out is said to be so, with no figure.

```text
- Malformed calls per 1,000: 64.0, 8 of 125 calls; up 44.0; first 100.0; best 20.0 (28 Sept).
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address, and the page text after it for anything the context does not cover; `view_platform_status` answers the same text from anywhere in the console, and `explore_platform_status` (`src/views/platform-status-explore.ts`), offered on this page alone, counts the platform's calls, refusals and malformed calls over any window, with the malformed calls per 1,000.

### What the agent does here

Protagonist: The paired figures, malformed calls per 1,000 and refusals put right.

- "How many malformed calls per 1,000 calls did real work make in the last 30 days?" — the malformed calls per 1,000 calls over 30 complete days
- "Which tool is called the wrong way most?" — the malformed calls over 30 complete days, by tool
- "Who are this week's refusals put down to?" — the refusals over 7 complete days, by owner
- "Are malformed calls rising week on week?" — the malformed calls per 1,000 calls over 90 complete days, by week

## Surfaces

Console, desktop and phone. Reads `GET /platform/status` on the console's server, as the person, once per request and bounded at 4.5 seconds; nothing is cached across callers. It declares no live collection: its figures are whole weeks and whole days, and the next visit reads them again.
