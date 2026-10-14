# Knowledge log

Every node recorded or retired, newest first, and who wrote it down.

## Structure

- Gate first: the page asks for `knowledge` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read.
- Tiles: entries, recorded, superseded.
- A data table headed Recorded and superseded, newest first: when, act, node (title now, or as typed), team, who.

## States

- Loading: skeleton rows.
- Empty: the log starts at the next node minted or superseded.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `knowledgeLogContext` in `src/views/knowledge-log-context.ts`, the same function `view_knowledge_log` calls, so the assistant quotes the figures the screen shows. Ask is in the head of the log's table, Recorded and superseded: what was recorded and superseded most recently, by whom, and what replaced what.

### What the agent reads

Whose log it is, how many entries it holds, and how many of them record a node and how many supersede one. What code found: the latest entries newest first, each with its date, its act, the node and its title, what replaced it and who did it (12 at most). It says the log starts when it was first kept, so an older node is on the shelf and not in the log.

```text
- The latest entries, newest first: 11 Oct 2026 recorded node 0003 (beacon), "Alert on the trend, not the count" by noah.okafor; …
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `query_knowledge_log` looks up what the page lists.

## Surfaces

Console, desktop and phone. Reads `GET /knowledge/log`. Live: follows `knowledge`, so a change made anywhere — another tab, another person — reads this page again.
