# Usage

How real work called the platform's tools, week by week: how much, how fast, what was refused and put right, when in the week it came, which tools it used, and what the platform's own model calls were. Both roles open it; a superadmin's weeks are split by team, a member's are not.

## Structure

- Gate first: the page asks for `usage`, which needs `platform:read`, before it renders, so a person who does not hold it is answered by the refused page and nothing on the page is read. Its title comes from `gatedMetadata` and its loading state from `gatedLoading`, so under `refusal: 'absent'` neither names the page.
- Masthead: the kicker `ZZ Stack · Platform`, the title, one sentence and the as-of line (the read's own `meta.asOf`), drawn before the read answers.
- Tiles, the last whole week: Calls, Share refused, Slowest 5% of calls and Sessions, each with its weeks as its shape and its change on the week before in ink, never green or red: a movement is an observation, not a judgement. A week with no figure reads `No data`, and one the gateway could not count `Unavailable`, never zero.
- Calls by week, the page's protagonist: ZZ Meridian's Column chart of real-work calls by Monday week, the running week drawn unfinished. For a superadmin each column is split into the three teams with the most calls and `Other`, in one hue; a member's weeks carry no split and name no team. Ask is in the card's head. The tiles, this chart and the refusals put right share one cursor.
- Refusals put right by week (Column chart): of the refusals that could be followed, the share followed within 120 seconds by an answered call of the same tool in the same session. Under it, for the week pointed at or the last whole week: the share with how many could be followed, the median seconds to the call that put it right, the refused sessions that went on, and the refusals that could not be judged (no session, or still inside the lookahead). A median over fewer than 30 reads `too few`.
- The platform's own traffic (Composition bar): every call of the last whole week, real work beside the platform's own maintenance, which every other figure leaves out.
- All refusals by population (Composition bar): every refusal of the last whole week, real work's under its four owners (tool failures critical, malformed calls a warning, a guardrail that held and other neutral) and the platform's maintenance apart.
- Each tool's median call (table): each registered tool's median call in its first comparable week against the last whole week, each with the week and the calls it is over, and the change as a plain movement; a median over fewer than 30 calls is `too few` and its change `Not comparable`.
- Weekday by hour (Heatmap): the real-work calls of the complete weeks shown, by weekday and hour in the reporting time zone the read names, which the Heatmap's `timezone` labels. The weeks are named from the later of the record's first day and the first hour observed when either falls inside them, and the grid is drawn only once a whole week was observed from there (never while the record has no first day); until then the card says a whole week is not observed yet, so no hour nobody saw is drawn as 0.
- Tools called most (Bar list): the last whole week's calls by tool; a call to a tool no door registers is counted under `Unregistered tools`, so the name a caller sent is never shown.
- Calls per recorded approval (Key value): the last whole week and the week before, each with its calls and the approvals zz-core recorded; a week with none recorded says so.
- The platform's model calls (Key value): the last whole week's calls and failures, the week before, the tokens in and out, the calls by purpose, and the cost, `Not recorded`.
- Every figure is the gateway's: the browser counts, splits and ranks nothing.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx` while the gate asks `/me`, then the masthead over four tile skeletons, the two charts', the compositions' and the table's while the read is under way |
| Default | Every card above |
| A member | The same cards; the calls by week have no split and no team is named anywhere |
| A part unavailable | That card says it could not be read and why; every other card stands |
| A week missing | Its column keeps its place and reads `No data`; a tile reads `No data` or `Unavailable`, never zero |
| Nothing that week | A composition with nothing in it says so in its card |
| Read failed | The error state with the gateway's sentence and Retry, which asks the server again |
| Slower than 4.5 seconds | The same error state, saying the read did not answer within 4.5 seconds, with Retry; never an endless skeleton |

## Agents

The assistant reads this page and changes nothing. The page shares its context through `usageContext` in `src/views/platform-usage-context.ts`, built from the same read and the same words as the page, and `view_usage` builds the same context from the same response (`GET /platform/usage`), so the assistant quotes the figures the screen shows. Ask is on the calls by week: how the calls moved and, for a superadmin, which teams made them, or, with the cursor on a week, what made up that week.

### What the agent reads

The last whole week's four tiles with the week before; the platform's own traffic and every refusal by population; calls per recorded approval for both weeks; the model calls with their failures, their purposes and the cost not recorded. What code found: the calls by week (split by team for a superadmin), the refusals followed in the last whole week and put right by week, each tool's median first week to last, and the tools called most. When the budget is tight the tools called most go first, and the context says the page shows more. It says that these are observations and no movement is better or worse, that a week with no figure is missing and not zero, which refusals could not be judged, the time zone the hours are in, that a member's page names no team, and which parts could not be read.

```text
- Calls: 125, the week before 200. (Real-work tool calls in the last whole week, refused or answered; maintenance is left out.)
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address, and the page text after it for anything the context does not cover; `view_usage` answers the same text from anywhere in the console, and `explore_usage` (`src/views/usage-explore.ts`), offered on this page alone, counts the platform's calls, its refusals by owner and its model calls over any window, by team for a superadmin alone.

### What the agent does here

Protagonist: Calls by week.

- "How many real-work calls did the platform answer each week this quarter?" — the calls over 90 complete days, a week at a time
- "Which tools were called most in the last 30 days, and how many of those calls were refused?" — the calls over 30 complete days, by tool, then by refused
- "Who were last week's refusals put down to?" — the refusals over 7 complete days, by owner
- "On which weekday does real work call the platform most?" — the calls over 30 complete days, by weekday
- "How many model calls did the platform make each week this month?" — the model calls over 30 complete days, a week at a time
- "Which teams made the most calls in the last 30 days?" — the calls over 30 complete days, by team, a superadmin's question alone

## Surfaces

Console, desktop and phone; at 390px the table is a card list. Reads `GET /platform/usage` on the console's server, as the person, once per request and bounded at 4.5 seconds; nothing is cached across callers. It declares no live collection: its figures are whole weeks, and the next visit reads them again.
