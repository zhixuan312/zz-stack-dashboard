# Knowledge

What the platform has learned, kept as nodes, each out of a real initiative.

## Structure

- Tabs: Nodes, Log.
- Tiles: nodes, adopted, superseded, last recorded.
- A data table of nodes with search, team (platform mode) and tag filters; rows open the node.

## States

- Loading: skeleton rows.
- Empty: nothing to read yet.
- Filtered to nothing: Clear filters.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `knowledgeContext` in `src/views/knowledge-context.ts`, the same function `view_knowledge` calls, so the assistant quotes the figures the screen shows. Ask is in the filter bar: what the listed nodes say taken together, or what the platform has learned most about.

### What the agent reads

Whose shelf it is and the filters in force, then how many nodes match, how many are adopted and superseded, and when the last was recorded. What code found: the commonest tags, the count by team, the latest node, and the nodes listed newest first (15 at most). It says that a node's own text is on its page, that search reads the title and the excerpt, and that the store links two nodes only through a shared tag.

```text
- The commonest subjects: search 4, payments 2, alerts 1, data 1, flow:sdlc-flow 1, ops 1, research 1.
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `query_knowledge` looks up what the page lists. `view_search` is how it reads what a node says beyond the title and opening excerpt listed here, and what any document says: the platform's ranked search over their text, as the person, each result a matched excerpt with its address.

## Surfaces

Console, desktop and phone. Reads `GET /knowledge`. Live: follows `knowledge`, so a change made anywhere — another tab, another person — reads this page again.
