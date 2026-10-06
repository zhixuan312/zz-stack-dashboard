# Document

One document, read: the text, how it changed and on what evidence, and the claims it makes.

## Structure

- Masthead: the title, the path and version, and Approve when the reader may sign the gate.
- When Approve is on offer, the page records that it showed the reader the snapshot it rendered, once per snapshot,
  and Approve signs exactly that snapshot under the review context the record answered.
- Document: type, status, approver and update facts, then the text rendered or as stored.
- Changes and their reasons: the sources first, then the diff between content versions.
- Content history and the claims table.

## States

- Loading: skeleton cards.
- Approve is held until the snapshot on screen is recorded as shown.
- Approve swaps for an inline confirmation; success and refusal each say so in a toast.
- Out of date: the document changed after the page showed it, or no record of showing it covers what the store holds
  now. A banner says so in the gateway's words, with Reload; a reload records the snapshot it brings.
- A document with no body says so.
- Not found: the gateway's sentence.

## Surfaces

Console, desktop and phone. Reads `GET /document/:team/:slug/:path`, `POST /documents/shown`,
`POST /documents/approve`.
