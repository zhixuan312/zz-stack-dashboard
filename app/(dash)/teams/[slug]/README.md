# Team

One team: what it is working on, what it holds, and who is in it.

## Structure

- Tiles: initiatives, waiting on you, members, knowledge nodes.
- Initiatives: a data table, rows open the initiative.
- Members: a data table with role and when they joined.

## States

- Loading: tiles read an ellipsis, tables show skeleton rows.
- A team with no work: the initiatives table says nobody has started a piece of work.
- No such team: the description says so and nothing else renders.

## Surfaces

Console, desktop and phone. Reads `GET /teams/:slug`, `GET /initiatives?team=`, `GET /teams`.
