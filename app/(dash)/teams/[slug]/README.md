# Team

One team: what it holds, how much of its work is open and waiting, and who is in it.

## Structure

- Gate first: the page asks for `teams` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read.
- Tiles: initiatives (with how many are still open), revisions waiting, members, knowledge nodes, all from the team's own read.
- Members: a data table with role and when they joined.

## States

- Loading: tiles read an ellipsis, tables show skeleton rows.
- No such team: an empty state naming the slug, with the way back to the list. The read answered rather than failed, so it is the `filtered` empty and not the error one — but a blank body would be a dead end, and this page owes the reader a way on.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `teamContext` in `src/views/team-context.ts`, the same function `view_team` calls, so the assistant quotes the figures the screen shows. Ask is in the head of the Members table: who is in the team, who administers it, and who joined most recently.

### What the agent reads

The team's name, status and creation date, then how many initiatives it has and how many are open, its revisions waiting, its members and admins, and what its shelf holds. What code found: every member with their role and when they joined (25 at most). It says that the team's initiatives are its own to read, so they are not listed.

```text
- Its people: Ava Lindqvist (admin, joined 3 Mar 2026); Noah Okafor (member, joined 9 Jun 2026).
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `explore_team`, offered on this page alone, counts the team's real-work calls over any window, every call held to this team.

### What the agent does here

Protagonist: Members.

- "How many real-work calls did this team make in the last 30 days?" — the platform's calls over 30 complete days, held to this team
- "Which tools does this team call most?" — the platform's calls over 30 complete days, by tool
- "How did its calls move week by week this quarter?" — the platform's calls over 90 complete days, a week at a time

## Surfaces

Console, desktop and phone. Reads `GET /teams/:slug`, whose counts are the team's own. Live: follows `teams`, so a change made anywhere — another tab, another person — reads this page again.
