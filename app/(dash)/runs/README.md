# Runs

Every run your active team recorded, by the skill that drove it.

## Structure

- Gate first: the page asks for `runs` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read.
- Tiles: runs since the first, observed output per run with the runs nothing measured, the largest run with its skill.
- Where the work happens: every skill the team ran, ranked by observed output per run, runs, calls per run or typical length, each with its share of the chosen axis and its share refused.

## States

- Loading: skeletons; the tiles read `…`.
- Empty: the team has run no skill yet.
- Single-call runs: a line under the table says they have no span to time.
- Output nothing measured reads `Not measured`, never zero.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `runsContext` in `src/views/runs-context.ts`, the same function `view_runs` calls, so the assistant quotes the figures the screen shows. Ask is in the head of the Where the work happens table: which skill's runs answer the most output, and why it matters.

### What the agent reads

Whose runs these are and since when, then how many, the observed output per run with how many were not measured, and the largest run. What code found: the time the runs cover with overlapping time counted once, against the summed length, the most at once and the runs of one call; each skill by observed output per run, with its runs, typical length and share refused; and the latest runs with their state (active, last call at a time, or one call). It says that observed output is the bytes a run's calls answered, not what a model read and not a cost, and that no run is said to be running past its last call.

```text
- The runs cover 10.4 h, overlapping time counted once, against 10.8 h summed; at most 2 ran at once, and 3 were one call.
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `explore_runs`, offered on this page alone, counts the team's runs and their observed output over any window, by skill, initiative, weekday or hour, down to the runs themselves.

### What the agent does here

Protagonist: Where the work happens.

- "Which skill ran most in the last 30 days?" — the runs over 30 complete days, by skill
- "Which skill answered the most output this quarter?" — the observed output over 90 complete days, by skill
- "On which weekday do our runs start most?" — the runs over 90 complete days, by weekday

## Surfaces

Console, desktop and phone. Reads `GET /runs?skill&limit&offset`. Live: follows `runs`, so a change made anywhere — another tab, another person — reads this page again.
