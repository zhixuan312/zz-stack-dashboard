# Initiative

One initiative end to end: where it is in its flow, its documents, and the evidence behind them, and Close.

## Structure

- Gate first: the page asks for `initiatives` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read.
- First read on the console's server: the initiative is read as the person, bounded at 4.5 seconds, with the team they act for, before anything is drawn, as a document's page is; `loading.tsx` stands meanwhile. The one read is handed to the masthead and the body. Later reads, after a close or a hint that initiatives changed, are the browser's.
- Masthead: the work's name as the title, as its documents name it: a flow's documents are titled by their kind and the name ("Spec: relevance that explains itself"), so the name the most of them carry (`initiativeName`, `src/views/initiative-name.ts`). The slug stands under it in mono. Where no document names the work, the slug is the title, whole on one line: it is an identifier, so it steps down to the size at which it fits the masthead's width rather than breaking after a hyphen. Then the state badge, Review beside "Waiting on you" opening the document the person is waited on for (the first gate written and not approved, or a closed initiative's correction), and Close initiative while it is open and of the team the person acts for. The next step is the one filled button: Review while a document waits on the person, with Close the secondary button beside it; Close, filled, when nothing does.
- The cards, Progress, Documents and Sources, stand one row gap apart, as on every page.
- Close: a dialog of three choices. Accepted sends `{ disposition: 'finished' }`; Delivered sends `{ disposition: 'finished', no_signoff_reason }` with the person's reason nobody signed it off; Abandoned sends `{ disposition: 'abandoned' }`. An initiative with no flow names the document a finished close lands on. The dialog never sends an outcome or a closer: it shows the outcome and the closer the gateway answered. An initiative with nothing written in it offers Abandoned alone, the close it may take: the platform records it on the initiative, on no document.
- Progress: the flow stepper, stages as circles and gates as diamonds, with the outcome on the closing node.
- Documents: in the order the flow produces them, with approval and approver.
- Sources: the evidence attached, in natural order of their names. A source filed under a web address is named by the page's own name, the address's last part, with its host as a note beneath, on a phone's card too (`sourceName`); one with no title by its file.

## States

- Loading: skeletons for its progress, its documents and its sources.
- No flow: the stepper is left out and the documents still list.
- Nothing written: an initiative opened and never written in opens like any other; Documents says "Nothing written yet" and Close offers Abandoned alone.
- Closed: every node done and the outcome under the last.
- Not found: no initiative by that address, with the way back to Initiatives; the gateway's answer is one fixed sentence that names nothing asked for.
- Error: the gateway's sentence and Retry; a read that did not answer in 4.5 seconds says so.
- Read again: Retry reads in the browser, busy only after the person presses it and until that read answers. A read a change starts leaves the state and its Retry, or the way back to Initiatives, where they are, so a keyboard user keeps their place.
- Close refused: the gateway's sentence in the dialog, what the person typed kept. Closed first by somebody else (409): "Somebody closed it first." with the gateway's sentence; the first decision stands.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. It never closes an initiative: the context says the close is made with Close initiative, in the dialog, and `view_initiative` takes nothing a close is made of. The page shares its context through `initiativeContext` in `src/views/initiative-context.ts`, the same function `view_initiative` calls, so the assistant quotes the figures the screen shows. Ask is in the head of the Documents table, which every initiative has, with a flow or without: where the initiative stands and which of its documents needs the person next.

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
- "Close this initiative for me." — nothing is asked of the prepared query: the answer names this page and Close initiative, where the person closes it in the dialog, and says the assistant closed nothing

## Surfaces

Console, desktop and phone. Reads `GET /initiatives/:team/:slug`, first on the console's server. Writes `POST /initiatives/:team/:slug/close`, from the dialog alone. Live: follows `initiatives`, so a change made anywhere — another tab, another person — reads this page again.
