# Activity

Every tool call, gate and admin act the platform recorded, newest first.

## Structure

- Show everything or refusals only.
- A data table: when, kind, subject, actor, team, result, refusal; a refusal is the one row in colour.

## States

- Loading: skeleton rows.
- Empty: nothing recorded yet.
- Refusals only, none: Clear filters.

## Surfaces

Console, desktop and phone. Reads `GET /activity?limit=200`.
