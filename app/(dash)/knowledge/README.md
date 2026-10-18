# Knowledge

What your active team has learned, kept as lessons, each out of a real initiative, and what its searches found. It leads with the platform's own ranked search.

## Structure

- Gate first: the page asks for `knowledge` before it renders, so a person who does not hold it is shown nothing of the page and nothing on it is read. Every role holds `work:read`, so a member and a superadmin both open it, each for the team they act for.
- Tabs: Overview, Log. Log is `/knowledge/log`, the page's log, which the destinations table keeps (FR-18).
- Search what your team has learned: one field and a Search button. The search runs when the person submits the question, never as they type, because every search is counted. It is the platform's own ranked search (`GET /search`), the one the assistant and MCP use, over the team's documents and lessons and the platform's shared shelf. The results come back in the gateway's order, best first, at most ten: each its title, whether it is a lesson or a document, its shelf (`Your team` or `Shared shelf`), what superseded it, and its matched excerpt with the matched terms strong. A lesson opens its node page, a shared one read-only; a document opens its own page. No line calls a result an answer: a result is text that matched.
- Tiles: lessons adopted with the imported among them, superseded, searches last week and searches with no result, each from the summary. The tiles' row carries `data-figures="read"` once the summary answered.
- The team's own questions that found nothing, most asked first, as the gateway orders them, with how often each was asked and when last.
- Searches with results, by week: a Column chart of the share of the team's searches that found something, the running week drawn unfinished. A week with no search has no column and reads `No searches`, never 0%. The card's line states the count behind the last whole week's share.
- Newest lessons, with a link to the log, beside the shelf: a data table of ten lessons a page, filtered by kind and paged by the gateway, newest first: number, title, kind, status, recorded.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx` while the gate asks `/me` and the server reads the summary: the search card, four tiles and the shelf, in skeleton |
| No question yet | The field, and a line saying what the search reads |
| Searching | Three skeleton rows under the field |
| Results | The ranked results, with the count of the ranked total shown |
| Nothing found | `Nothing found for "<question>"`, with the search's own sentence about the empty answer |
| Search failed | `The search did not run`, the gateway's sentence and Retry |
| Summary failed, or slower than 5 seconds | The tiles read `—`, `The shelf's figures did not load` says why with Retry, which reads again on the server, and each card from the summary says it was not read; the search and the shelf still work |
| A part of the summary unavailable | That card alone says it did not load, with the gateway's reason |
| Shelf empty / of no lesson of a kind | `Nothing on the shelf yet`, or Clear filters |

## Agents

The assistant reads this page and changes nothing: no tool adds, supersedes or edits a lesson, and a lesson is recorded by zz-core when an initiative closes. The page shares its context through `knowledgeContext` in `src/views/knowledge-context.ts`, the same function `view_knowledge` calls, so the assistant quotes the figures the screen shows. Ask is in the head of Search what your team has learned: what the results for the question say and what they leave open, or, before any question, which questions found nothing and where else to look.

### What the agent reads

Whose shelf it is, the question searched, the kind and page in force, then the results in view, best first, each with its kind, its shelf and what superseded it; how many lessons are adopted with the imported among them, how many are superseded, last week's searches and those with no result. What code found: the team's own questions that found nothing, most asked first; searches with results over the last four weeks; the newest lessons; the count by kind; and the shelf's page in view. It says that a search that found something is retrieval coverage, which does not settle the question, and that the shared shelf is searched beside the team's and is not on the shelf listed.

```text
- The search for "latency budget" ranked 4; in view, best first: lesson "Latency budgets are per hop, not per request" (your team's shelf); …
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `view_knowledge` answers the same summary, the shelf's page and, given the question, the titles of the same ranked results; `view_search` reads what the results say, each excerpt with its address. `explore_knowledge`, offered on this page and on its log, counts the shelf, the lessons made and the searches over Work's prepared query (`/work/query`), by kind, standing or whether a search found anything.

### What the agent does here

Protagonist: Search what your team has learned.

- "How many of our searches found nothing in the last 30 days, and what did they ask?" — the searches that found nothing over 30 complete days, down to their questions
- "Did more of our searches find something this month than last?" — the searches over 90 complete days, a month at a time, by whether each found something
- "Which kind of lesson did we make most this quarter?" — the lessons made over 90 complete days, by kind
- "How many lessons stand on our shelf, by kind?" — the shelf of standing lessons, by kind

## Surfaces

Console, desktop and phone. Reads `GET /knowledge/summary` on the console's server, as the person, once per request and bounded at 5 seconds; then `GET /search?q&limit` and `GET /knowledge?kind&limit&offset` from the browser. Live: follows `knowledge`, so a change made anywhere — another tab, another person — reads the shelf again in the browser and asks the server for the summary again.
