# Teams

Every team on the platform, who is in it and what it holds.

## Structure

- Gate first: the page asks for `teams` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read.
- A data table: team (slug and name), status, people, initiatives, documents, sources, knowledge; rows open the team.
- Filter bar: search and status, kept in the address.

## States

- Loading: skeleton rows.
- Error: the gateway's sentence and Retry.
- Empty: no team yet, created in Settings.
- Filtered to nothing: Clear filters.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `teamsContext` in `src/views/teams-context.ts`, the same function `view_teams` calls, so the assistant quotes the figures the screen shows. Ask is in the filter bar: about the filtered list, or about which teams are busy and which have gone quiet.

### What the agent reads

The filters in force, how many teams match and how many are active, and the initiatives, documents and knowledge nodes the listed teams hold. What code found: the team running the most work with its share, the active teams that have started nothing, and the teams listed with their status, people, initiatives and knowledge (25 at most). It says that People counts memberships, so it does not sum to a number of people.

```text
- atlas runs the most work: 4 of the 8 initiatives listed (50%). Evidence: /teams/atlas
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `query_teams` looks up what the page lists.

## Surfaces

Console, desktop and phone. Reads `GET /teams?limit=100`, every team on one page. Live: follows `teams`, so a change made anywhere — another tab, another person — reads this page again.
