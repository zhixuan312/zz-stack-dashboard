# Ask

A question answered from one team's own documents, with citations the platform built.

## Structure

- Tiles: the team answering, nodes on its shelf, subjects.
- The question, the answer and its citations; what the answer reads from, beside it.
- A team picker in platform mode.

## States

- No team chosen: the question box is disabled and says to pick one.
- Asking: a spinner and a line saying the documents are being read.
- Refused: the gateway's sentence in a banner that stays.

## Surfaces

Console, desktop and phone. Reads `GET /knowledge`, `POST /ask?team=`.
