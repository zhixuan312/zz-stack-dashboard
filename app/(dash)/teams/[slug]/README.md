# Team

One team: what it is working on, what it holds, and who is in it.

## Structure

- Gate first: the page asks for `teams` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read.
- Tiles: initiatives, waiting on you, members, knowledge nodes.
- Initiatives: a data table, rows open the initiative.
- Members: a data table with role and when they joined.

## States

- Loading: tiles read an ellipsis, tables show skeleton rows.
- A team with no work: the initiatives table says nobody has started a piece of work.
- No such team: the description says so and nothing else renders.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `teamContext` in `src/views/team-context.ts`, the same function `view_team` calls, so the assistant quotes the figures the screen shows. No Ask on this page: its tiles and two tables are read whole.

### What the agent reads

The team's name, status and creation date, then its initiatives and how many are open, how many wait on a person, its members and admins, and what its shelf holds. What code found: the initiatives waiting with the gates they wait on, every initiative with its state and stage, and every member with their role and when they joined (25 at most).

```text
- Waiting on a person: 2026-09-28-search-relevance (approve plan); 2026-10-02-query-latency (approve spec); 2026-10-03-ranking-weights (approve spec); 2026-10-04-index-rebuild (approve spec); 2026-09-12-onboarding-revamp (approve review). Evidence: /initiatives?team=atlas&show=waiting
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `query_initiatives` looks up what the page lists.

## Surfaces

Console, desktop and phone. Reads `GET /teams/:slug`, whose counts are the team's own, and `GET /initiatives?team=`. Live: follows `teams and initiatives`, so a change made anywhere — another tab, another person — reads this page again.
