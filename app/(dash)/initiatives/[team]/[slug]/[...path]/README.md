# Document

One document, read: the text, how it changed and on what evidence, and the claims it makes.

## Structure

- Gate first: the page asks for `initiatives` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read.
- Masthead: the title, the path and version, and Approve when the reader may sign the gate; a member whose session
  acts for another of their teams is told which team to switch to.
- When Approve is on offer, the page records that it showed the reader the first snapshot it rendered, and any later
  one when the reader reloads, and Approve signs exactly that snapshot under the review context the record answered.
- Document: type, status, approver and update facts, and the review metadata an approval signs with the body
  (stakeholder, tags, each of the flow's own fields), then the text rendered or as stored.
- Changes and their reasons: the sources first, then the diff between content versions.
- Content history and the claims table.

## States

- Loading: skeleton cards.
- Approve is held, busy, until the snapshot on screen is recorded as shown.
- Approve swaps for an inline confirmation (Confirm, then Cancel on the edge Approve sat on); success and refusal each
  say so in a toast. The confirmation closes when the record it opened on is replaced.
- Changed while reading: a refetch brought a newer snapshot. It is on screen, a banner says so, and Approve is held
  until Reload records it.
- Out of date: the document changed after the page showed it, or no record of showing it covers what the store holds
  now. A banner says so in the gateway's words, Approve is held, and Reload records the snapshot it brings.
- Approve is unavailable: the record of showing it failed. The banner says so, then the gateway's words, with Reload.
- A document with no body says so.
- Not found: the gateway's sentence.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `documentContext` in `src/views/document-context.ts`, the same function `view_document` calls, so the assistant quotes the figures the screen shows. Ask is on the Document card: what it commits the team to and what to check before approving, or what it says in a few lines.

### What the agent reads

The document's path, its initiative and flow, then where it stands with its gate, its type, version, size, stakeholder and when it changed. What code found: how its text opens (1,200 characters; the page text carries the rest), that approval is given on this page by a member of the team and never by an agent, its versions with who approved each, the sources attached to it, and how many claims its ledger records.

```text
- Approval is given on this page, by a member of the document's team who has been shown this exact snapshot. An agent cannot approve it.
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `query_initiatives` looks up what the page lists.

## Surfaces

Console, desktop and phone. Reads `GET /document/:team/:slug/:path`, `POST /documents/shown`, Live: follows `document`, so a change made anywhere — another tab, another person — reads this page again.
`POST /documents/approve`.
