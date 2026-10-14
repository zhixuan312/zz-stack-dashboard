# Runs

Every recorded run, by the skill that drove it.

## Structure

- Gate first: the page asks for `runs` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read.
- Tiles: runs, calls in runs, payload moved.
- Where the work happens: every skill, ranked by calls, runs, median or total time, each with its share of the chosen axis.

## States

- Loading: skeletons.
- Empty period: no skill ran.
- Single-call runs: a line under the table says they have no span to time.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `runsContext` in `src/views/runs-context.ts`, the same function `view_runs` calls, so the assistant quotes the figures the screen shows. Ask is in the head of the Where the work happens table: which skills did the most work over the period and where calls were refused.

### What the agent reads

The period, then the runs recorded, the calls in them with how many were refused, and the payload moved. What code found: the skill that drove the most runs with its share, the skills refused on more than 5% of their calls, the skill that pulls the most into context, and every skill with its runs, calls and median run (15 at most). It says that an unmeasured payload is unknown and not zero, and that a run is timed only when it has more than one call.

```text
- zz-platform drove the most runs: 210 of 1,261 (17%), at 16.1 calls a run.
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `query_skills` looks up what the page lists.

## Surfaces

Console, desktop and phone. Reads `GET /runs?period=`, `GET /skills?period=`. Live: follows `runs and skills`, so a change made anywhere — another tab, another person — reads this page again.
