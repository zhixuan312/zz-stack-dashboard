# Initiatives

Every piece of work, open or closed, and how far through its flow it got.

## Structure

- A data table: initiative, team (platform mode), flow position, state, gates passed, updated; rows open the initiative.
- Filter bar: search, team, flow and state, and a Waiting on you switch; the reporting period windows the list by when it was last touched.

## States

- Loading: skeleton rows.
- Error: the gateway's sentence and Retry.
- Empty: no initiative yet.
- Filtered or windowed to nothing: Clear filters.

## Surfaces

Console, desktop and phone. Reads `GET /initiatives`.
