# Knowledge health

The knowledge store's health: what stands on each shelf, what was made week by week with the imports told apart, how the platform's searches went, and, for a superadmin alone, the questions the searches that found nothing asked. Both roles open it; a superadmin reads every team's shelf by its slug, a member their own team's shelf, the shared shelf and every shelf's totals, and nothing that names another team.

## Structure

- Gate first: the page asks for `knowledge-health`, which needs `platform:read`, before it renders, so a person who does not hold it is answered by the refused page and nothing on the page is read. Its title comes from `gatedMetadata` and its loading state from `gatedLoading`, so under `refusal: 'absent'` neither names the page.
- Masthead: the kicker `ZZ Stack · Platform`, the title, one sentence and the as-of line (the read's own `meta.asOf`), drawn before the read answers.
- Tiles: Lessons adopted (standing on every shelf now, imports included); and for the last whole week, Made last week (outside the import cohorts), Searches last week and Share with no result, each with its change on the week before in ink, never green or red: a movement is an observation, not a judgement. A week whose change cannot stand beside the week before says what the week before was. A week with no figure reads `No data`, and one the gateway could not count `Unavailable`, never zero.
- Each shelf (table), the page's protagonist: each shelf's standing, superseded and imported lessons, and the last whole week's lessons made outside the import cohorts, searches and share with no result. A superadmin's rows are every team by slug, their own marked `(your team)`, the shared shelf marked `(shared)`, and `All shelves`; a member's are `Your team's shelf`, `The shared shelf` and `All shelves`, and name no team. Ten a page, as every table; with more shelves than a page, `All shelves` is on the last. Ask is in the table's head.
- Lessons made by week (Column chart): the lessons made each week outside the import cohorts, the running week drawn unfinished. Its line says the week from which an import is told exactly, by the lesson its `knowledge.add` event names, and that before it an import is told by the day rule and labelled `imported, by day`. Under it, for the week pointed at or the last whole week: the lessons made, those left out as imported exactly and those left out by the day rule; and one line naming every week that left an import out, with how many and how.
- Searches with no result by week (Column chart): the share of real-work searches that found nothing, a share over fewer than thirty searches `too few`. Under it, for the week pointed at or the last whole week: that share with the searches it is over, the share the engine widened, and the mean results a search returned. The two charts share one cursor.
- Lessons by the week made (Bar list): every lesson by the week it was made, imports included, each week with its import labelled (`96 imported, by day` when any of them rests on the day rule) and how many have been superseded since; nothing records when a lesson was superseded.
- Lessons by kind (Bar list): the standing lessons by the kind each was given.
- Questions with no result (table), the superadmin's alone: the questions real-work searches that found nothing asked, by question and the team that asked, over the weeks the charts draw, most asked first, ten of them with the total. A member's page has no such card, and no other page names a question another team asked.
- Neither more lessons nor fewer searches is drawn as better: no figure takes a status colour, no bar is the accent's for being longest, and no sentence calls a movement good or bad.
- Every figure is the gateway's: the browser counts, splits and ranks nothing.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx` while the gate asks `/me`, then the masthead over four tile skeletons, the table's, and the four charts' while the read is under way |
| Default | Every card above |
| A member | The tiles, the shelves as their own, the shared one and the totals, the four charts; no team is named and there is no questions card |
| A part unavailable | That card says it could not be read and why; every other card stands, and the Ask stays on the shelves' card |
| A week missing | Its column keeps its place and reads `No data`; a tile reads `No data` or `Unavailable`, never zero |
| Nothing yet | A fresh deployment: the counts at zero and the share with no result `No data`, every shelf at zero, the weeks at zero with no share, a line saying no import has named its lessons yet, and the lists saying no lesson was made, none stands and every search found something |
| Read failed | The error state with the gateway's sentence and Retry, which asks the server again |
| Slower than 4.5 seconds | The same error state, saying the read did not answer within 4.5 seconds, with Retry; never an endless skeleton |

## Agents

The assistant reads this page and changes nothing. The page shares its context through `knowledgeHealthContext` in `src/views/platform-knowledge-context.ts`, built from the same read and the same words as the page, and `view_knowledge_health` builds the same context from the same response (`GET /platform/knowledge`), so the assistant quotes the figures the screen shows. Ask is on the shelves: what stands on each shelf and how each team's searches went, or, for a member, how their shelf and the shared one stand beside the totals.

### What the agent reads

The four tiles with the week before. What code found: each shelf with its figures; the lessons made by week, the week from which imports are told exactly and every week's imports left out, exactly or by the day rule; the share of searches with no result by week, with the last whole week's share widened and mean results; for a superadmin, the questions with no result, most asked first; the lessons by the week made with their imports labelled and those superseded since; and the lessons by kind. When the budget is tight the kinds go first, then the cohorts, and the context says the page shows more. It says that these are observations and neither more lessons nor fewer searches is better, that a week with no figure is missing and not zero, that an import stays in every inventory and its cohort and in no week's lessons made, that nothing records when a lesson was superseded, that a member's page names no other team's shelf and that the questions are the superadmin's alone, and which parts could not be read.

```text
- Lessons adopted: 142. (Lessons standing on every shelf now, imports included; one a later lesson superseded is left out.)
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address, and the page text after it for anything the context does not cover; `view_knowledge_health` answers the same text from anywhere in the console, and `explore_knowledge_health` (`src/views/knowledge-health-explore.ts`), offered on this page alone, counts the lessons made and the searches over any window, and drills the searches that found nothing to their questions for a superadmin alone.

### What the agent does here

Protagonist: Each shelf.

- "How many lessons were made outside imports each week this quarter?" — the lessons made over 90 complete days, outside the import cohorts, a week at a time
- "Which kinds of lesson were made in the last 30 days?" — the lessons made over 30 complete days, by kind
- "How many lessons did imports bring in this quarter, and on which shelves?" — the imported lessons over 90 complete days, by shelf
- "What share of last month's searches found nothing, and how many were widened?" — the searches over 30 complete days, the share that found nothing and the widened count
- "On which weekday do searches find nothing most?" — the searches that found nothing over 30 complete days, by weekday
- "What did the searches that found nothing last week ask?" — the searches that found nothing over 7 complete days, with up to 20 of their questions and the team that asked each, a superadmin's question alone

## Surfaces

Console, desktop and phone; at 390px each table is a card list. Reads `GET /platform/knowledge` on the console's server, as the person, once per request and bounded at 4.5 seconds; nothing is cached across callers. It declares no live collection: its figures are whole weeks, and the next visit reads them again.
