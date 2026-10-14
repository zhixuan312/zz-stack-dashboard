# Initiatives

Every piece of work, open or closed, and how far through its flow it got.

## Structure

- Gate first: the page asks for `initiatives` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read.
- A data table: initiative, team (platform mode), flow position, state, gates passed, updated; rows open the initiative.
- Filter bar: search, team, flow and state, and a Waiting on you switch; the reporting period windows the list by when it was last touched.

## States

- Loading: skeleton rows.
- Error: the gateway's sentence and Retry.
- Empty: no initiative yet.
- Filtered or windowed to nothing: Clear filters.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `initiativesContext` in `src/views/initiatives-context.ts`, the same function `view_initiatives` calls, so the assistant quotes the figures the screen shows. Ask is in the filter bar: which are stuck and what each waits on, or which to approve first when the list shows only what waits on a person.

### What the agent reads

The period, whose work it is and every filter in force, then how many initiatives match and how many of those are open, waiting on a person and closed. What code found: the count by state, each initiative waiting with the gate it waits on, which of those are already closed and waiting on a correction, the open initiative untouched longest, the count by flow, and the initiatives listed (12 at most). It says that the period windows on when an initiative was last touched, not on when it was opened.

```text
- 2 of those are already closed: atlas/2026-09-12-onboarding-revamp; beacon/2026-09-22-payout-schedule. A closing document changed after the close and awaits approval again, so the State column still reads the outcome while the initiative is listed as waiting.
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `query_initiatives` looks up what the page lists.

## Surfaces

Console, desktop and phone. Reads `GET /initiatives`. Live: follows `initiatives`, so a change made anywhere — another tab, another person — reads this page again.
