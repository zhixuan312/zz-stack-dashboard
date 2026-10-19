# Releases

Every release the platform has recorded, week by week, each with what was observed in the 72 hours either side of it, read on the console's server.

## Structure

- Gate first: the page asks for `releases` before it renders, so a person who does not hold it is answered by the refused page and nothing on the page is read. Every role holds `platform:read`, so a member and a superadmin both open it. Its title comes from `gatedMetadata`, so under `refusal: 'absent'` it names nothing; its loading state (`OfferedLoading`) is headed Releases for a person whose own rail offers it, at `/platform/releases` alone, and keeps `gatedLoading`'s words, which name nothing, for anyone else and in the prerendered shell.
- Masthead: the kicker `ZZ Stack · Platform`, the title, one static sentence and the as-of line, the read's own `meta.asOf`. The masthead is drawn before the read answers.
- Tiles: Releases (every one recorded) and Last week (tagged in the last whole Monday week, the week the chart marks, named under it: `Week of 5 Oct`), each with its unit (`2 releases`), Latest tag (its version, and when its tag was made: a tag, not a deployment, which Status names) and Migrations applied (with when the last one was). No release yet reads `None recorded`, never a zero version.
- The weeks: Releases by week and Malformed calls per 1,000 by week, two Column charts side by side on one Meridian, so pointing at a week in one points the other at it. A Monday week a column, the running week drawn unfinished, a week with no rate an empty track, never a zero. A release is in the week whose days hold the day its row prints: the gateway cuts its weeks in the deployment's timezone, the one the console prints a day in, so a tag at 02:21 on a Monday is that Monday's week. The last whole week is marked, and it is the one the Last week tile counts.
- The table, the page's protagonist: version (with the console it shipped with), tagged, summary (with `Within 72 hours of <versions>` under it when another release falls inside either window), client action, tool failures and p95, and malformed calls per 1,000, each before and after, with `partial` beside a side the record saw only part of (its bounds in the cell's title). A side reads its label, then its figure or its word alike: `Before 4.2`, `Before not observed`, `After no calls`. The version, the date and every side hold their line and the summary takes the slack, so the table stays inside its card; malformed calls per 1,000 is the last column at every width, since a narrower table drops tool failures and p95, so the column at the card's edge always takes its padding. Ten rows a page, newest first, paged by the gateway; a row opens the release's page. Ask is in the table's head. On a phone a row is a card: the version and its date, then its summary, `Clients: <action>` and `Malformed per 1,000: 4.2 before; 3.3 after (partial)` (a word in lower case, wherever it falls in the sentence: `not observed before; 15.8 after (partial)`, `22.7 before; no calls after`), each a line that may wrap. A tag with no changelog section, which the record writes `Unknown — no recorded upgrade notes`, reads `Not recorded`, as a release's missing console version does.
- Nothing on the page sets the two sides of a release against each other as a verdict on it: a window is what was observed around the release, and other releases, the mix of tools and the traffic move it too.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx` while the gate asks `/me`, headed Releases for a person whose rail offers it (`OfferedLoading`), then the masthead over four tile skeletons, the two charts' and the table's while the read is under way |
| Default | The tiles, the weeks and a page of releases, a row gap apart |
| No release yet | The tiles with `None recorded`, the weeks as the record has them, and "No release recorded yet" |
| A release under 72 hours old | Its after-window reads `partial`, and its title says it is still running |
| A before-window begun before the record | `Before not observed`, never a zero rate |
| A window with no calls | `After no calls`, with no rate and no p95 |
| Rows unavailable | The tiles and the weeks stand; the table's error state says the releases could not be listed |
| Read failed | Each tile a dash, and the table's error state with the gateway's sentence and Retry |
| Slower than 4.5 seconds | The same error state, saying the read did not answer within 4.5 seconds, with Retry; never an endless skeleton |
| Read again | The table's Retry reads again in the browser, busy only after the person presses it and until that read answers; a read a change starts leaves the error state and its Retry where they are, never busy, so a keyboard user keeps their place |

## Agents

The assistant reads this page and changes nothing. The page shares its context through `releasesContext` in `src/views/platform-releases-context.ts`, the same function `view_releases` calls on the same response, so the assistant quotes the figures the screen shows.

### What the agent reads

The four tiles with what each counts, each release on the page (up to five, each whole and as many as fit, and how many more) with when its tag was made, both sides' malformed calls per 1,000 with `partial` where a side is, both sides' tool failures and p95, its client action and the releases within 72 hours of it, then the last eight whole weeks' releases and malformed calls per 1,000 with the running week so far, the first to go when the context is over its budget. It says that a window is what was observed and not what a release did, that a tag's time is historical timing, that under 30 calls a side is too few to compare and no calls is no rate, what a partial side is, when the rows could not be listed, and how many more releases are on later pages. It is dated with the read's own cutoff, as the masthead prints it (`As of 20 Oct 2026, 03:15.`), never the moment the data arrived in the browser.

```text
- The releases on this page, newest first, each side before then after: 0.97.1 (17 Oct): malformed per 1,000 4.2 then 3.3 (partial); tool failures 3 then 0; p95 1,840 ms then 1,620 ms; clients: Nothing to do; within 72 hours of 0.97.0; …
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `view_releases` answers the same text from anywhere in the console, and `explore_releases` (`src/views/releases-explore.ts`), offered on this page alone, counts the releases, the migrations applied and the malformed calls over any window, with the malformed calls per 1,000, and drills to each release with its page.

### What the agent does here

Protagonist: Releases.

- "How many releases went out each week this quarter?" — the releases over 90 complete days, a week at a time
- "How have malformed calls per 1,000 moved week by week in the last 30 days?" — the malformed calls per 1,000 calls over 30 complete days, a week at a time
- "How many migrations were applied in the last 90 days?" — the migrations applied over 90 complete days
- "Which releases were tagged in the last 7 days?" — the releases over 7 complete days, down to each release with its page

## Surfaces

Console, desktop and phone; at 390px the table is a card list of the version, when it was tagged and its malformed calls per 1,000 before then after. Reads `GET /platform/releases?limit=10&offset=…` on the console's server, as the person, once per request and bounded at 4.5 seconds; another page of rows is read in the browser. It declares no live collection: a release is recorded once, when its tag is made, and the next visit reads it.
