# Knowledge node

One knowledge node, read, with where it was learned and what shares its subject: a lesson of the active team's, or one on the platform's shared shelf, which a search finds and anybody signed in opens, marked Shared.

## Structure

- Gate first: the page asks for `knowledge` before it renders, so a person who does not hold it is shown nothing of the page and nothing on it is read.
- No Knowledge tabs: a node is a detail page, and its breadcrumb is the way back to Knowledge. The breadcrumb starts at the workspace, `ZZ Stack · Work / Knowledge / <team> · node <number>`, as every other Work page's does.
- A neutral banner when the node is superseded, naming the node that replaced it and linking it when it is among the node's neighbours (a supersession needs nobody, so it wears no warning colour), and a banner when it is on the shared shelf.
- The lesson, rendered, at the page's width; under it, About this node in two columns where there is room: status, shelf (`Your team` or `Shared`), type, team, recorded, learned in, tags, path. Nothing on the page changes a lesson.
- Learned in: the initiatives of the team the reader acts for, each linked to its page on one line, never broken at a hyphen, and how many initiatives of other teams the lesson was learned in, a count with no name and no link (`cited_elsewhere`). A shared lesson cites other teams' work, which is theirs: the node's answer names only the reader's team's.
- Nodes that share a tag: number, title, status, shared tags, recorded. Every row opens its node, and a quiet arrow after its title says so where a still shows it. A neighbour a later lesson replaced reads `Superseded` by the node that replaced it, a link where that node is listed too, so it is never read as current beside its successor; a current one reads `Adopted`.

## States

- Loading: two skeleton cards while the gate asks `/me` and the server reads the node.
- Superseded: the banner names the node that replaced it.
- Shared: the banner says it is on the platform's shared shelf, which every team's search reads beside its own lessons, and the shelf reads `Shared`.
- No text: the lesson panel says "This lesson has no text in the store."
- Not found, failed, or slower than 4.5 seconds: `This node did not load`, the gateway's sentence and Retry, which reads again on the server.
- An address that names no node, its team or its path an escape that does not decode or holding a `.` or `..` segment: the missing page, titled Not found, and nothing is read.
- Signed out since the gate: sign-in, and back to the node after it.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `knowledgeNodeContext` in `src/views/knowledge-node-context.ts`, the same function `view_knowledge_node` calls, so the assistant quotes the figures the screen shows. Ask is on The lesson: what it means for work under way now.

### What the agent reads

The node's team and number, its status, its shelf, type, date and tags; a shared one's scope says it is on the platform's shared shelf. What code found: the lesson itself (its first 1,400 characters; the page text carries the rest), the node that superseded it, the initiatives of the reader's team it was learned in with their addresses and how many of other teams' with no name, and the nodes that share a tag with it, each superseded one said to be and by which node (10 at most). Under Unknown it always says what it does not carry: who recorded the lesson (the knowledge log names who), that a citation names an initiative and not what in it the lesson stands on, and, where they apply, the text of the node that replaced it, the lesson past its first 1,400 characters, and that a neighbour is named by its title alone. The lesson is in the context on purpose: `view_knowledge_node` is how the assistant reads what an earlier initiative settled without the person opening the node.

```text
- It was learned in 2026-10-02-query-latency (/initiatives/atlas/2026-10-02-query-latency), and in 1 initiative of another team, which is not named here.
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `explore_knowledge_node`, offered on this page at any depth of its path, counts the shelf and the lessons made of this lesson's kind, every call held to that kind: the prepared query keys no lesson by itself.

### What the agent does here

Protagonist: The lesson.

- "How many lessons of this kind stand on our shelf, and how many were superseded?" — the shelf of this lesson's kind, by standing
- "How many lessons of this kind did we make in the last 90 days?" — the lessons made of this lesson's kind over 90 complete days
- "When were lessons of this kind made, month by month?" — the lessons made of this lesson's kind over every complete day kept, a month at a time

## Surfaces

Console, desktop and phone. Reads `GET /knowledge/:team/:path` on the console's server, as the person, once per request and bounded at 4.5 seconds. Live: follows `knowledge`, so a change made anywhere — another tab, another person — asks the server for this page again.
