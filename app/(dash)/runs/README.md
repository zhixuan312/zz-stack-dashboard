# Runs

Every recorded run, by the skill that drove it.

## Structure

- Tiles: runs, calls in runs, payload moved.
- Where the work happens: every skill, ranked by calls, runs, median or total time, each with its share of the chosen axis.

## States

- Loading: skeletons.
- Empty period: no skill ran.
- Single-call runs: a line under the table says they have no span to time.

## Surfaces

Console, desktop and phone. Reads `GET /runs?period=`, `GET /skills?period=`.
