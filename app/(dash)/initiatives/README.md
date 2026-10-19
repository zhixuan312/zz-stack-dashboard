# Initiatives

The active team's work, open or closed, and where each goes next, filtered and paged by the server.

## Structure

- Gate first: the page asks for `initiatives` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read.
- First read on the console's server: the address's page of the list is read as the person, bounded at 4.5 seconds, and handed to the page; a filter, a search or a page moves the address and the server reads it again. Later reads, after a close or a hint that initiatives changed, are the browser's.
- The Records template: three tiles over the whole team's work, whatever the filters, each with its line (Open `of N in the team`, Waiting `of the N open`, Closed with its split by outcome), then the table, the page's protagonist, so it starts above the fold at 1440px, then the closures by outcome, a column a week, month or quarter (the grain the gateway cuts the team's record at, named in the title) split into accepted, delivered and abandoned in Record's categorical slots, the running period drawn unfinished.
- The table: ten rows a page, paged by the server: initiative, flow position (zz-core's next move), state, gates passed, last touched; rows open the initiative, and a quiet arrow after its name says so, as on Status and a plugin's rows. Each column is as wide as what it holds: the slug on one line, the flow position taking the rest so it reads on one or two lines, and gates passed shown wherever the table is 896px or wider. At 390px a row is a card: the slug and its state, the flow position on a line of its own, then the gates passed and the last touch; no line of it starts with a separator.
- The Waiting tile's figure is ink like the others: the accent is kept for what a person presses.
- Flow position: zz-core's next move in words. A closed initiative that still waits on an approval waits on its correction (the closing document changed after the close), and says so: "Approve the correction to review.md, waiting on a person".
- Filter bar: search on the slug, state (open, waiting, quiet, accepted, delivered, abandoned) and flow, each sent to the route; no period and no Team column, since Work is the active team's.

## States

- Loading: headed Initiatives for a person whose rail offers it (`OfferedLoading`), over three tiles, skeleton rows and the chart, in the page's order.
- Error: the gateway's sentence and Retry; the tiles read `—`. A read that did not answer in 4.5 seconds says so.
- Read again: the table's Retry reads again in the browser, busy only after the person presses it and until that read answers; a read a change starts leaves the error state and its Retry where they are, never busy, so a keyboard user keeps their place.
- Partial: closures that could not be read say so, with no grain named; the tiles and the rows stand.
- Empty: no initiative yet.
- Filtered to nothing: Clear filters.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. It closes nothing; a person closes an initiative with Close initiative on its own page, and the context says so. The page shares its context through `initiativesContext` in `src/views/initiatives-context.ts`, the same function `view_initiatives` calls, so the assistant quotes the figures the screen shows. Ask is in the filter bar: which initiatives need the person next and what each waits on, or what the filtered ones have in common.

### What the agent reads

Whose work it is, every filter in force and the page, then how many initiatives match (counted on the server over all of them) and the team's open, waiting and closed counts, the closed split by outcome. What code found: the count by state, the rows in view with their state, gates, last touched and next move, the count by flow, and the last four whole weeks' closures by outcome. It says that another team's work is not in this list, and when zz-core could not say a row's next move.

```text
- Rows 1 to 10 of 12, waiting first: 2026-09-28-search-relevance (waiting, 1 of 3 gates, touched 15 Oct 2026; next: Approve plan.md, waiting on a person); …
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `explore_initiatives`, offered on this page alone, counts the team's closures and openings over any window, by outcome or flow, down to the initiatives themselves.

### What the agent does here

Protagonist: Initiatives.

- "How many initiatives did we open and close in the last 90 days?" — the initiatives opened and the closures over 90 complete days
- "Which flow do our closed initiatives come from, and with what outcome?" — the closures over every complete day kept, by flow, then by outcome
- "How many were opened each month this quarter?" — the initiatives opened over 90 complete days, a month at a time

## Surfaces

Console, desktop and phone. Reads `GET /initiatives?state&flow&q&limit&offset`, first on the console's server. Live: follows `initiatives`, so a change made anywhere — another tab, another person — reads this page again.
