# Document

One document, read: the text, how it changed and on what evidence, and the claims it makes.

## Structure

- Masthead: the title, the path and version, and Approve when the reader may sign the gate.
- Document: type, status, approver and update facts, then the text rendered or as stored.
- Changes and their reasons: the sources first, then the diff between content versions.
- Content history and the claims table.

## States

- Loading: skeleton cards.
- Approve swaps for an inline confirmation; success and refusal each say so in a toast.
- A document with no body says so.
- Not found: the gateway's sentence.

## Surfaces

Console, desktop and phone. Reads `GET /document/:team/:slug/:path`, `POST /documents/approve`.
