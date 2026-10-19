# Knowledge log

Knowledge's log: every node recorded or retired, newest first, and who wrote it down. A tab of Knowledge, which the destinations table keeps (FR-18).

## Structure

- Gate first: the page asks for `knowledge` before it renders, so a person who does not hold it is shown nothing of the page and nothing on it is read.
- Tabs: Overview, Log, as Knowledge draws them.
- Tiles: entries, recorded, superseded.
- A row opens its node while the node is on the shelf: the log answers each entry's `path`, the node's address, and null for one deleted since, whose row opens nothing. A row that opens its node carries the quiet arrow after its title, as every row that opens a page does; one whose node is gone carries none.
- A data table headed Recorded and superseded, newest first: when, act, node (title now, or as typed, over its number), who, by the address the platform holds for them, as every page names a person; `—` where the platform named nobody for the act. On a phone each entry is a card of the title with its number, the act, the date and who. Dates are absolute, each on one line: the log is read on the server. Both acts are neutral badges, `Recorded` and `Superseded`: a supersession is a lesson's ordinary life and needs nobody, so it wears no warning colour, and `node 0004 → 0005` says what replaced what.

## States

- Loading: skeleton rows while the gate asks `/me` and the server reads the log.
- Empty: the log starts at the next node minted or superseded.
- Read failed, or slower than 4.5 seconds: the tiles read `—`, and `The entries did not load` says why with Retry, which reads again on the server.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `knowledgeLogContext` in `src/views/knowledge-log-context.ts`, the same function `view_knowledge_log` calls, so the assistant quotes the figures the screen shows. Ask is in the head of the log's table, Recorded and superseded: what was recorded and superseded most recently, by whom, and what replaced what.

### What the agent reads

Whose log it is, how many entries it holds, and how many of them record a node and how many supersede one. What code found: the latest entries newest first, each with its date, its act, the node and its title, what replaced it and who did it (12 at most). It says the log starts when it was first kept, so an older node is on the shelf and not in the log.

```text
- The latest entries, newest first: 11 Oct 2026 recorded node 0003 (beacon), "Alert on the trend, not the count" by noah.okafor@example.com; …
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `explore_knowledge_log`, offered on this page, is Knowledge's own prepared query: it counts the shelf, the lessons made and the searches over any window, by kind, standing or whether a search found anything.

### What the agent does here

Protagonist: Recorded and superseded.

- "How many lessons did we record each week this month?" — the lessons made over 30 complete days, a week at a time
- "Which kind of lesson did we record most in the last 90 days?" — the lessons made over 90 complete days, by kind
- "How many lessons on our shelf have been superseded?" — the shelf, by standing

## Surfaces

Console, desktop and phone. Reads `GET /knowledge/log` on the console's server, as the person, once per request and bounded at 4.5 seconds. Live: follows `knowledge`, so a change made anywhere — another tab, another person — asks the server for this page again.
