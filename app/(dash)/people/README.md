# People

Everyone the platform knows, their teams, and whether their tokens are live.

## Structure

- Gate first: the page asks for `people` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read.
- Tiles: people, live tokens, never used a token, teams.
- A data table: person, role or deactivated, teams, tokens, last used, joined; search and a team filter.

## States

- Loading: skeleton rows.
- Empty: nobody yet.
- Filtered to nothing: Clear filters.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `peopleContext` in `src/views/people-context.ts`, the same function `view_people` calls, so the assistant quotes the figures the screen shows. Ask is in the filter bar: who holds a live token they have never used, and who has none.

### What the agent reads

Whose people these are and the filters in force, then how many match, how many are superadmins, the live tokens and how many people hold them, who has never used one, and the distinct teams. What code found: the superadmins by name, the people with no platform call on record, the deactivated, and the people listed with their role, teams and tokens (15 at most). It says a token's value is never shown: only its count and when it last worked.

```text
- No platform call is on record for Maximiliana Fitzgerald-Oyelaran Kowalczyk.
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `query_people` looks up what the page lists.

## Surfaces

Console, desktop and phone. Reads `GET /people?limit=100`, the first page of every person the platform knows — the gateway caps a read at 100, so the answer's `total` is the population and the page says how much of it it holds. Live: follows `people`, so a change made anywhere — another tab, another person — reads this page again.
