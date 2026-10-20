# Bugs

Every real bug report: what is open, how long the oldest has waited, how often reports are filed against the platform's calls, how long a report takes to resolve, and the queue, read on the console's server.

## Structure

- Gate first: the page asks for `bugs` before it renders, so a person who does not hold it is answered by the refused page and nothing on the page is read. Every role holds `platform:read`, so a member and a superadmin both open it. Its title comes from `gatedMetadata`, so under `refusal: 'absent'` it names nothing; its loading state (`OfferedLoading`) is headed Bugs for a person whose own rail offers it, at `/platform/bugs` alone, and keeps `gatedLoading`'s words, which name nothing, for anyone else and in the prerendered shell.
- Masthead: the kicker `ZZ Stack · Platform`, the title, one static sentence and the as-of line, the read's own `meta.asOf`. The masthead is drawn before the read answers.
- Tiles: Open (every report not yet resolved), Oldest open (how long it has waited at the cutoff, and when it was filed; `None open` when none is), Reports per 1,000 calls (the last whole week's, labelled with its week as a sentence writes a day, `Week of 5 Oct`; `under 30 calls` beside a rate too few to compare, `no calls` when the week had none) and Median hours to resolve (over every resolved report, with how many are resolved and how many still open; `None resolved` when none is).
- The queue, the page's protagonist, right after the tiles, on a phone too: the report's title (the reporter's own and the team for the superadmin; for a member the spec's public title the gateway builds from the surface alone, `Report concerning document_approve`, or `Platform issue reported` for a surface outside the vocabulary or none, so nothing the reporter wrote is in it; two reports on one surface share a title, and their impact, filed date and status, each a column of its own, tell them apart), its impact, surface, when it was filed, the version it was filed against, and its status with when it was resolved. Ten rows a page, newest filed first, filtered by state, impact and surface and paged by the gateway. Only the superadmin's rows open a report's page; a member's open nothing. Ask is in the queue's filter bar.
- The weeks: Filed by week and Resolved by week filed, two Column charts side by side on one Meridian, so pointing at a week in one points the other at it. A report resolved is counted in the week it was filed, and both charts say so. The running week is drawn unfinished.
- Outcomes, a Composition bar of every report by where it stands (open, fixed, not a bug, duplicate), over By impact, a Bar list of every report by its impact; beside them the median hours to resolve by week filed, a Column chart of whole weeks where a week with no resolved report has no column, never a zero. The running week is left out until it ends: its median would be only the reports resolved within days of filing, and its word, `No data so far`, is wider than a phone's column.
- The filters narrow the queue alone: every tile and chart is over every real report. A report is filed by choice, so nothing on the page reads fewer reports as better.
- The surface filter offers the doors (`core`, `manage`, `eval`) and `console`, then every surface a report on the page names: no read lists the tools the doors register.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx` while the gate asks `/me`, headed Bugs for a person whose rail offers it (`OfferedLoading`), then the masthead over four tile skeletons, the queue's and the two charts' while the read is under way |
| Default | The tiles, a page of the queue, the weeks, the outcomes, the impacts and the median by week, a row gap apart |
| A filter set | The figures as before, and the queue the gateway filtered, read on the console's server for the new address |
| No report yet | `None open` and `None resolved`, the weeks as the record has them, and "No bug report yet" |
| No report matches the filters | The figures stand, and the queue's filtered empty state with Clear filters |
| A week under 30 calls, or with none | `under 30 calls` beside its rate, or `no calls`, never a zero |
| Counts unavailable | The open tile reads `Unavailable` and the outcomes say they could not be counted; the weeks and the queue stand |
| Queue unavailable | The figures stand; the queue's error state says it could not be listed |
| Read failed | Each tile a dash, and the queue's error state with the gateway's sentence and Retry |
| Slower than 4.5 seconds | The same error state, saying the read did not answer within 4.5 seconds, with Retry; never an endless skeleton |
| Read again | The table's Retry reads again in the browser, busy only after the person presses it and until that read answers; a read a change starts leaves the error state and its Retry where they are, never busy, so a keyboard user keeps their place |

## Agents

The assistant reads this page and changes nothing. The page shares its context through `bugsContext` in `src/views/platform-bugs-context.ts`, the same function `view_bugs` calls on the same response, so the assistant quotes the figures the screen shows.

### What the agent reads

The four tiles with what each counts, the queue on the page (up to four, each title whole and as many as fit, and how many more) with each report's title in the caller's form, impact, surface, when it was filed and against which version, and its status, then the outcomes and the impacts of every report, then the last eight whole weeks' filed, resolved and still open counts, reports per 1,000 calls and median hours, with the running week so far, the first to go when the context is over its budget. It says that a report is filed by choice and is not a distinct defect, that a week's resolved count and median are of the reports filed that week, that under 30 calls a rate is too few to compare, that the filters narrow the queue alone, what a member cannot read, and how many more reports are on later pages. It is dated with the read's own cutoff, as the masthead prints it (`As of 20 Oct 2026, 03:15.`), never the moment the data arrived in the browser.

```text
- The queue, newest first: Report concerning document_approve: blocks work, filed 10 Oct, open; …
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `view_bugs` answers the same text from anywhere in the console, and `explore_bugs` (`src/views/bugs-explore.ts`), offered on this page alone, counts the reports filed and resolved over any window, by impact, state, surface or outcome, with reports per 1,000 calls, and drills to each report in the caller's form.

### What the agent does here

Protagonist: Queue.

- "How many reports that block work were filed in the last 30 days?" — the reports filed over 30 complete days with impact blocks_work, down to each report
- "How have reports per 1,000 calls moved week by week this quarter?" — the reports filed per 1,000 calls over 90 complete days, a week at a time
- "How were the reports filed in the last 90 days resolved?" — the reports resolved over 90 complete days, by outcome
- "Which surfaces drew the most reports in the last 30 days?" — the reports filed over 30 complete days, by surface
- "Resolve the newest open report for me." — nothing is asked of the prepared query: the answer names the report's own page and Resolve report where the person may open it, and otherwise says resolving a report is not a change they can make; it never says one was resolved

## Surfaces

Console, desktop and phone; at 390px the queue is a card list of the report's title, its impact, when it was filed and its status. Reads `GET /platform/bugs?state=&impact=&surface=&limit=10&offset=…` on the console's server, as the person, once per request and bounded at 4.5 seconds; a filter or another page of rows moves the address and is read on the server again. It declares no live collection: the next visit reads what was filed since.
