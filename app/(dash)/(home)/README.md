# Overview

The platform's census, or one team's: whether work is moving, and what waits on a person.

## Structure

- Gate first: the page asks for `home` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read.
- Featured metric: tool calls over the period, with the trend of all calls, calls attributed to a run, and refused calls (one Meridian).
- Three tiles beside it: initiatives progressing (median completeness, and what waits on a person), knowledge from work, context per run.
- Open work by stage: one composition bar over the active initiatives.
- Refusals: refused calls by tool or by message, each bar a share of the total; the gateway's refusal rate in the line under the title.
- Event kinds: every event kind, each bar a share of all events.

## States

- Loading: a skeleton shaped like the featured card, the tile column and the two panels.
- Error: the gateway's sentence and Retry.
- Empty period: the featured card says no tool call was recorded; the panels say nothing was refused.
- Team mode: the same page over the caller's team.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `overviewContext` in `src/views/overview-context.ts`, the same function `view_overview` calls, so the assistant quotes the figures the screen shows. Ask is on the featured card (what stands out in tool calls and why, or why the bucket the chart points at looks the way it does) and on Refusals (which matter most, and what would stop them).

### What the agent reads

The period and whose data it is, the bucket the chart's pointer rests on with its calls and how they split, then every tile with the tile's own definition: tool calls, initiatives progressing, what waits on a person, knowledge from work, context per run and the refusal rate, each with its change against the previous period where one exists. What code found: how the calls split between runs, outside runs and refusals; the busiest bucket; open initiatives by stage; the tool and the message refused most; the shelf's size and how often it was searched. It says that context per run is KB of tool output and not a token count, how many runs were never measured, and why a figure carries no change.

```text
- core:document_read refused most often: 30 of the 73 refused calls (41%). Evidence: /activity?show=failed
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `query_initiatives` looks up what the page lists.

## Surfaces

Console, desktop and phone. Reads `GET /overview?period=`. Live: follows `overview`, so a change made anywhere — another tab, another person — reads this page again.
