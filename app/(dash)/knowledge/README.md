# Knowledge

What your active team has learned, kept as lessons, each out of a real initiative, and how its searches went.

## Structure

- Gate first: the page asks for `knowledge` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read.
- Tabs: Nodes, Log.
- Tiles: standing lessons with the imported among them, superseded, searches last week, and those that found nothing.
- A data table of ten lessons a page, paged by the server, newest first: number, title, kind, status, recorded; a search and a kind filter, sent to the route; rows open the lesson.

## States

- Loading: skeleton rows; the tiles read `…`.
- Empty: nothing to read yet.
- Filtered to nothing: Clear filters.
- A read that failed: the tiles read `—` and the shelf's figures say why, and the list says the lessons did not load. `…` means a read is still coming, and a read that has failed is not still coming.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `knowledgeContext` in `src/views/knowledge-context.ts`, the same function `view_knowledge` calls, so the assistant quotes the figures the screen shows. Ask is in the filter bar: what the listed lessons say taken together, or what the team has learned most about and which questions found nothing.

### What the agent reads

Whose shelf it is, the filters in force and the page, then how many lessons match, how many stand with the imported among them, how many are superseded, and last week's searches with those that found nothing. What code found: the team's own questions that found nothing, most asked first; the lessons in view; the count by kind; searches with results over the last four weeks; and the newest lessons. It says that a search that found something is retrieval coverage and not an answer, and that the platform's shared shelf is searched beside the team's and is not on this list.

```text
- The team's own questions that found nothing, most asked first (13 in all): "how do we rotate the signing key" 3×, last 13 Oct 2026; …
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `query_knowledge` pages the route with its text and kind filters and answers the route's total. `view_search` is how it reads what a lesson says beyond the title and opening excerpt listed here, and what any document says: the platform's ranked search over the team's shelf and the shared one, as the person, each result a matched excerpt with its address.

## Surfaces

Console, desktop and phone. Reads `GET /knowledge/summary` and `GET /knowledge?q&kind&limit&offset`. Live: follows `knowledge`, so a change made anywhere — another tab, another person — reads this page again.
