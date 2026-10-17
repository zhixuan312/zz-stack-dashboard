# Knowledge node

One knowledge node, read, with where it was learned and what shares its subject.

## Structure

- Gate first: the page asks for `knowledge` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read.
- A warning banner when the node is superseded.
- The lesson, rendered; facts beside it: status, type, team, recorded, learned in, tags, path.
- Nodes that share a tag.

## States

- Loading: two skeleton cards.
- Superseded: the banner names the node that replaced it.
- Not found: the gateway's sentence.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `knowledgeNodeContext` in `src/views/knowledge-node-context.ts`, the same function `view_knowledge_node` calls, so the assistant quotes the figures the screen shows. Ask is on The lesson: what it means for work under way now.

### What the agent reads

The node's team and number, its status, type, date and tags. What code found: the lesson itself (its first 1,400 characters; the page text carries the rest), the node that superseded it, the initiatives it was learned in with their addresses, and the nodes that share a tag with it (10 at most). The lesson is in the context on purpose: `view_knowledge_node` is how the assistant reads what an earlier initiative settled without the person opening the node.

```text
- It was learned in 2026-09-12-onboarding-revamp (/initiatives/atlas/2026-09-12-onboarding-revamp).
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `explore_knowledge_node`, offered on this page at any depth of its path, counts the shelf and the lessons made of this lesson's kind, every call held to that kind: the prepared query keys no lesson by itself.

### What the agent does here

Protagonist: The lesson.

- "How many lessons of this kind stand on our shelf, and how many were superseded?" — the shelf of this lesson's kind, by standing
- "How many lessons of this kind did we make in the last 90 days?" — the lessons made of this lesson's kind over 90 complete days
- "When were lessons of this kind made, month by month?" — the lessons made of this lesson's kind over every complete day kept, a month at a time

## Surfaces

Console, desktop and phone. Reads `GET /knowledge/:team/:path`, `GET /knowledge`. Live: follows `knowledge`, so a change made anywhere — another tab, another person — reads this page again.
