# Initiative

One initiative end to end: where it is in its flow, its documents, and the evidence behind them.

## Structure

- Gate first: the page asks for `initiatives` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read.
- Progress: the flow stepper, stages as circles and gates as diamonds, with the outcome on the closing node.
- Documents: in the order the flow produces them, with approval and approver.
- Sources: the evidence attached, in natural order.

## States

- Loading: skeletons for its progress, its documents and its sources.
- No flow: the stepper is left out and the documents still list.
- Closed: every node done and the outcome under the last.
- Not found: the gateway's sentence.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `initiativeContext` in `src/views/initiative-context.ts`, the same function `view_initiative` calls, so the assistant quotes the figures the screen shows. Ask is in the head of the Documents table, which every initiative has, with a flow or without: where the initiative stands and which of its documents needs the person next.

### What the agent reads

The initiative's state with what each state means, its position in its flow, how many of its gates are approved, and its documents and sources. What code found: the gates waiting on a person, the step it is at with what that step does and produces, every step's state, every document with its approval, and a correction awaiting approval after the close. It says when the initiative is closed, with what outcome, and whether it stopped short.

```text
- It is at the plan step: Turn an approved spec into a contract-first plan. That step produces plan.md.
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `explore_initiative`, offered on this page alone, counts this initiative's words, approvals, runs and calls over any window, every call held to this initiative.

### What the agent does here

Protagonist: Documents.

- "How many words has this initiative written in the last 30 days, and in which documents?" — the words written over 30 complete days, by document
- "Which skills ran for it this quarter, and how often?" — the runs over 90 complete days, by skill
- "How many of its calls were refused in the last 7 days?" — the calls over 7 complete days, by refused

## Surfaces

Console, desktop and phone. Reads `GET /initiatives/:team/:slug`. Live: follows `initiatives`, so a change made anywhere — another tab, another person — reads this page again.
