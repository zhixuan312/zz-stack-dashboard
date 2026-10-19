# Document

One document, read: the text, how it changed and on what evidence, and the claims it makes.

## Structure

- Gate first: the page asks for `initiatives` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read.
- First read on the console's server: the document is read as the person, bounded at 4.5 seconds, and handed to the masthead and the body, so its title, status and text are in the first paint. Later reads, after an approval, a Retry, a Reload or a hint that documents changed, are the browser's.
- Masthead: the kicker opens at the workspace, "ZZ Stack · Work", as every page's does, then the trail back up
  (Initiatives, the team, the initiative). The title (a source filed under a web address is titled by the page's own
  name, as its initiative lists it), the path and version, and Approve when the reader may sign the gate; a member
  whose session acts for another of their teams is told which team to switch to.
- When Approve is on offer, the page records that it showed the reader the first snapshot it rendered, and any later
  one when the reader reloads, and Approve signs exactly that snapshot under the review context the record answered.
- Document: type, status, approver and when it last changed ("Last changed", apart from the masthead's Updated stamp, which says when the page read it), and the review metadata an approval signs with the body
  (stakeholder, tags, each of the flow's own fields), then the text rendered or as stored.
- A table the text carries becomes cards where the text's column is under 480px, as on a phone: each row a card, its
  first cell the title and the rest beneath it, one to a line, under a key of the headings in the same order.
- Changes and their reasons: the sources first, then the diff between content versions.
- Content history and the claims table, counted in the word its rows are: claims, or a plan's tasks.

## States

- Loading: skeleton cards, while the console's server reads.
- Approve is held, busy, until the snapshot on screen is recorded as shown.
- Approve swaps for an inline confirmation (Confirm, then Cancel on the edge Approve sat on); success and refusal each
  say so in a toast. The confirmation closes when the record it opened on is replaced.
- Changed while reading: a refetch brought a newer snapshot. It is on screen, a banner says so, and Approve is held
  until Reload records it.
- Out of date: the document changed after the page showed it, or no record of showing it covers what the store holds
  now. A banner says so in the gateway's words, Approve is held, and Reload records the snapshot it brings.
- Approve is unavailable: the record of showing it failed. The banner says so, then the gateway's words, with Reload.
- A document with no body says so.
- Not found: "This document does not exist", with the gateway's sentence.
- Error: "This document did not load", with the gateway's sentence and Retry; a read that did not answer in 4.5 seconds says so.
- Read again: Retry, on the error and on not found, reads in the browser, busy only after the person presses it and until that read answers. A read a hint starts leaves the state and its Retry where they are, never busy, so a keyboard user keeps their place.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `documentContext` in `src/views/document-context.ts`, the same function `view_document` calls, so the assistant quotes the figures the screen shows. Ask is on the Document card: what it commits the team to and what to check before approving, or what it says in a few lines.

### What the agent reads

The document's path, its initiative and flow, then where it stands with its gate, its type, version, size, stakeholder and when it changed. What code found: how its text opens (1,200 characters; the page text carries the rest), that approval is given on this page by a member of the team and never by an agent, its versions with who approved each, the sources attached to it, and how many claims its ledger records.

```text
- Approval is given on this page, by a member of the document's team who has been shown this exact snapshot. An agent cannot approve it.
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `explore_document`, offered on this page at any depth of its path, counts the words this document gained and its initiative's approvals, every call held to this document.

### What the agent does here

Protagonist: Document.

- "How many words has this document gained in the last 30 days?" — the words written over 30 complete days, held to this document
- "How was it written week by week this quarter?" — the words written over 90 complete days, a week at a time
- "Were the approvals of its initiative shown to me before I gave them?" — the approvals of the document's initiative over every complete day kept, by presentation

## Surfaces

Console, desktop and phone. Reads `GET /document/:team/:slug/:path`, first on the console's server, `POST /documents/shown` and `POST /documents/approve`. Live: follows `document`, so a change made anywhere — another tab, another person — reads this page again.
