# Initiatives

The active team's work, open or closed, and where each goes next, filtered and paged by the server.

## Structure

- Gate first: the page asks for `initiatives` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read.
- The Records template: a data table of ten rows a page, paged by the server: initiative, flow position (zz-core's next move), state, gates passed, last touched; rows open the initiative.
- Filter bar: search on the slug, state (open, waiting, quiet, accepted, delivered, abandoned) and flow, each sent to the route; no period and no Team column, since Work is the active team's.

## States

- Loading: skeleton rows.
- Error: the gateway's sentence and Retry.
- Empty: no initiative yet.
- Filtered to nothing: Clear filters.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `initiativesContext` in `src/views/initiatives-context.ts`, the same function `view_initiatives` calls, so the assistant quotes the figures the screen shows. Ask is in the filter bar: which initiatives need the person next and what each waits on, or what the filtered ones have in common.

### What the agent reads

Whose work it is, every filter in force and the page, then how many initiatives match (counted on the server over all of them) and the team's open, waiting and closed counts. What code found: the count by state, the rows in view with their state, gates, last touched and next move, and the count by flow. It says that another team's work is not in this list, and when zz-core could not say a row's next move.

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

Console, desktop and phone. Reads `GET /initiatives?state&flow&q&limit&offset`. Live: follows `initiatives`, so a change made anywhere — another tab, another person — reads this page again.
