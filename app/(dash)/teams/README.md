# Teams

Every team on the platform, who is in it and what it holds.

## Structure

- A data table: team (slug and name), status, people, initiatives, documents, sources, knowledge; rows open the team.
- Filter bar: search and status, kept in the address.

## States

- Loading: skeleton rows.
- Error: the gateway's sentence and Retry.
- Empty: no team yet, created in Settings.
- Filtered to nothing: Clear filters.

## Surfaces

Console, desktop and phone. Reads `GET /teams`.
