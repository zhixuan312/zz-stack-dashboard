# Activity

Your active team's real work by week: what was refused and why, the groups the refusals fall into, and everything it recorded, newest first.

## Structure

- Gate first: the page asks for `activity` before it renders, so a person who does not hold it is answered by the refused page and nothing on the page is read. Its title comes from `gatedMetadata`, so under `refusal: 'absent'` it names nothing; its loading state (`OfferedLoading`) is headed Activity for a person whose own rail offers it, at `/activity` alone, and keeps `gatedLoading`'s words, which name nothing, for anyone else and in the prerendered shell.
- Tiles, the last whole week: calls, with their weeks as the tile's shape; refused, with its four owners (a guardrail held, a malformed call, a tool failure, other), which sum to it; the tool refused most, of how many. Each tile says what it counts behind its info button.
- Refusals, the page's protagonist: refusals by week and owner, ZZ Meridian's Column chart with parts. Tool failures are critical, malformed calls a warning, a guardrail that held and other neutral, each named in the legend and the readout. The last whole week is the one the card is about; the running week is drawn unfinished. The chart and the calls tile share one cursor, so pointing at a week shows that week's calls on the tile. Ask is in the card's head.
- Refusals by owner, tool and message: the team's refusals as the gateway grouped them, most first, ten a page. Each tool's name is whole on one line, with no break point in it; the message takes the width left and wraps. A refusal recorded with no message says `No message recorded`. When the gateway folded the smallest groups, the table says how many and how many refusals they hold.
- The log: ten events a page, paged by the server: when, kind, tool, initiative, actor, result, why it was refused and its message. The tool takes the width left, and a time, a tool and an owner are each whole on one line. A person who acted is named by their whole email, as Approvals and the knowledge log name them, on one line where the table is 896px or wider and broken before its `@` under that, so the Result column stays in the frame. A tool call's actor reads `An agent`: the platform records no person for a call by design, so only the other events name who acted. On a phone each event is a card titled by its tool (its kind, for an event that called none), with its time, its kind and who acted (where somebody did) under it, and its result beside the title. A refusal is the one row in colour. Its four filters, kept in the address with the page and sent to the route: the initiative (its slug, typed), the kind and the tool (the values the log answers), and the result (refused, or not refused).
- The browser counts no owner, groups nothing and filters no row: every figure, group and row is the gateway's.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx` while the gate asks `/me` and the server reads the summary: headed Activity for a person whose rail offers it (`OfferedLoading`), over three tile skeletons, the chart's, and both tables' |
| Default | The tiles, the refusals by week, the groups, then a page of the log |
| Nothing recorded | The tiles at zero with nothing refused, `Nothing refused` in the groups, and `Nothing recorded yet` in the log |
| Filtered to nothing | The log says so with Clear filters; the tiles, the chart and the groups stand |
| Weeks or groups unavailable | That card says it did not load and why; the rest stands |
| Figures unavailable | A tile the gateway could not work out reads `Unavailable`, never zero or `None`: the calls, the refused and its owners when the weekly refusals were not read, and Most refused alone when last week's refusals by tool were not, beside a refused count that stands. `None` is said only of a week read with nothing refused |
| Summary failed | Each tile a dash, the gateway's sentence and Retry, which reads the summary in the browser; the log stands |
| Slower than 4.5 seconds | The same, saying the read did not answer within 4.5 seconds; never an endless skeleton |
| Read again | The figures' Retry reads again in the browser, busy only after the person presses it and until that read answers; a read a change starts leaves the state and its Retry where they are, never busy, so a keyboard user keeps their place |
| Log failed | The log's error state with the gateway's sentence and Retry; the summary stands |

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `activityContext` in `src/views/activity-context.ts`, the same function `view_activity` calls on the same two reads, so the assistant quotes the figures the screen shows. Ask is on the refusals card: what was refused last week and which group to fix first, or, with the cursor on a week, what was refused that week and who each refusal is put down to.

### What the agent reads

Whose work it is, last whole week's dates and the filters in force, the week the cursor rests on with its calls, its refusals and all four owners, then last week's calls, its refusals by owner (the four summing to the total), the tool refused most, and how many events match. What code found: the groups on the table's page in view, by owner, tool and message, with how many more and how many were folded; the refusals by week with their owners; the platform's maintenance, counted and left out, or said to be unavailable when it could not be read; and the events in view. A figure whose read failed is said to be unavailable, never zero or nothing refused. It says that page views and maintenance are left out, and that a refusal's message is the team's own as the platform stored it.

```text
- The team's refusals grouped by owner, tool and message, most first, groups 1 to 7 of 7 in view: A guardrail held on core:document_approve, "ERROR: approval needs a stakeholder" 5×, last 13 Oct 2026; …
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `view_activity` reads the summary and the page of the log its `kind`, `tool`, `initiative`, `refused`, `limit` and `offset` name; `explore_activity`, offered on this page alone, counts the team's calls and refusals over any window, by tool, initiative or owner, down to the events themselves.

### What the agent does here

Protagonist: Refusals.

- "Which tool was refused most in the last 30 days, and who is it put down to?" — the refusals over 30 complete days, by tool, then by owner
- "How many calls did we make each day this week, and how many were refused?" — the calls over 7 complete days a day at a time, then by refused
- "Which initiative made the most calls in the last 90 days?" — the calls over 90 complete days, by initiative
- "How many tool failures did we hit each week this quarter?" — the refusals over 90 complete days held to the owner theirs, a week at a time

## Surfaces

Console, desktop and phone; at 390px each table is a card list. Reads `GET /activity/summary` on the console's server, as the person, once per request and bounded at 4.5 seconds, and `GET /activity?kind&tool&initiative&refused&limit&offset` in the browser. Live: follows `activity`, so a change made anywhere — another tab, another person — reads the summary and the log again in the browser.
