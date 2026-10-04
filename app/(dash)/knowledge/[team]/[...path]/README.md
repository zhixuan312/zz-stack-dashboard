# Knowledge node

One knowledge node, read, with where it was learned and what shares its subject.

## Structure

- A warning banner when the node is superseded.
- The lesson, rendered; facts beside it: status, type, team, recorded, learned in, tags, path.
- Nodes that share a tag.

## States

- Loading: two skeleton cards.
- Superseded: the banner names the node that replaced it.
- Not found: the gateway's sentence.

## Surfaces

Console, desktop and phone. Reads `GET /knowledge/:team/:path`, `GET /knowledge`.
