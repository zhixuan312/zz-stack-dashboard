# Overview

The platform's census, or one team's: whether work is moving, and what waits on a person.

## Structure

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

## Surfaces

Console, desktop and phone. Reads `GET /overview?period=`.
