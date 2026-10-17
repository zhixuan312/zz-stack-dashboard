# Activity

Your active team's real work, newest first, with last week's calls and refusals above it.

## Structure

- Gate first: the page asks for `activity` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read.
- Tiles: calls last week; refused last week, with its four owners (a guardrail held, a malformed call, a tool failure, other); the tool refused most, of how many.
- Show everything or refusals only.
- A data table of ten events a page, paged by the server: when, kind, tool, initiative, actor, result, why it was refused and its message; a refusal is the one row in colour, and one recorded with no message says so. Filters for kind and tool, sent to the route.

## States

- Loading: skeleton rows; the tiles read `…`.
- Empty: nothing recorded yet.
- Filtered to nothing: Clear filters.
- A read that failed: the tiles read `—` and the table says why.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `activityContext` in `src/views/activity-context.ts`, the same function `view_activity` calls with the summary alone, so the assistant quotes the figures the screen shows. Ask is in the filter bar: what went wrong last week and which group of refusals to fix first, or, with Refusals only, which of them matter most.

### What the agent reads

Whose work it is, last whole week's dates and the filters in force, then last week's calls, its refusals by owner (the four summing to the total), the tool refused most, and how many events match. What code found: the team's refusals grouped by owner, tool and message, most first; the refusals by week with their owners; the platform's maintenance, counted and left out; and the events in view. It says that page views and maintenance are left out, and that a refusal's message is the team's own as the platform stored it.

```text
- The team's refusals grouped by owner, tool and message, most first (7 groups): A guardrail held on core:document_approve, "ERROR: approval needs a stakeholder" 5×, last 13 Oct 2026; …
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `view_activity` reads the summary; `explore_activity`, offered on this page alone, counts the team's calls and refusals over any window, by tool, initiative or owner, down to the events themselves.

### What the agent does here

Protagonist: Refusals.

- "Which tool was refused most in the last 30 days, and who is it put down to?" — the refusals over 30 complete days, by tool, then by owner
- "How many calls did we make each day this week, and how many were refused?" — the calls over 7 complete days a day at a time, then by refused
- "Which initiative made the most calls in the last 90 days?" — the calls over 90 complete days, by initiative

## Surfaces

Console, desktop and phone. Reads `GET /activity/summary` and `GET /activity?kind&tool&initiative&refused&limit&offset`. Live: follows `activity`, so a change made anywhere — another tab, another person — reads this page again.
