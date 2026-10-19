# Home

The active team's last whole week, what waits on it, and what is open, read on the console's server: the Work workspace's home.

## Structure

- Gate first: the page asks for `home` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read. `home` needs `work:read`, which a member and a superadmin both hold; Work is the active team's for the superadmin too.
- Masthead: the kicker `ZZ Stack · Work`, the title, which is the gateway's own sentence for the last whole week (`Home.title.sentence`, never rewritten in the browser; the page's name heads it when there is none), one line under it, and the as-of line, the read's own `meta.asOf`. The masthead is drawn before the read answers; the sentence, the as-of line and the body wait for it inside their own boundaries.
- The waiting strip, a Banner, only when something waits: one revision names itself and opens its document with Review; two or more say how many and since when the oldest has waited, and open Approvals. A queue that could not be read says so and is not an all-clear.
- One Featured metric of two halves on one cursor: words added last week (the words each revision added, never net of what a later one removed, as Record counts them) and approvals in the caller's name last week, each a Column chart by week with the running week drawn as so far, a week with no recorded value drawn as no data and read `None` in its column, a word a phone's column shows whole, and the gateway's finding under the figure, which names every week a tie is with (`tied with 14 Sept and 28 Sept`). Ask is in the card's head row. The foot: `One person, writing this`, last week's words at the stated pace and marked `estimated`, the observed run coverage and the peak concurrency, and one link, how it is estimated.
- Four tiles for the last whole week: work closed, median hours to close with the closures it is over, searches with results with their counts, and the days your agents ran of the week's seven.
- Open work: the waiting initiatives first, then the open ones, each with its next move from zz-core's `next_move` and its gates; the quiet folded into one row of their count; five rows at most, and the foot opens Initiatives. Beside it, the runs active now, four groups at most and the rest counted, or one line with when the last run ended.
- Next milestones, a Bar list: the next round number in each of four counts (pieces of work closed, documents created, lessons made, words added), each bar what is made of the next round number, from zero, the same way for every count (10 lessons of 25 is 40%), as the card's line says, with how far there is to go. Lessons made are those the team's own work made, superseded ones included and an import's left out, the count Record calls by the same name; Knowledge's lessons adopted are those standing on the shelf, a different count under a different name. Beside it, what closed last week with its outcome; the two cards are each their own height, so two closures beside four milestones leave no empty card.
- One line that opens Record, its arrow held to its last word, so at 390px the sentence wraps and the arrow never stands alone at the edge.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx` while the gate asks `/me`, headed by the page's name beside the sentence's block for a person whose rail offers Home (`OfferedLoading`), then the masthead over the body's skeleton while the read is under way |
| Default | Everything above |
| Nothing waits | No strip at all |
| One revision waits | The strip names it, with Review opening the document |
| A first week | The gateway's first-week sentence; the halves draw the weeks there are |
| A quiet week | The gateway's quiet-week sentence; the figures as they are |
| Empty | Nothing open, nothing closed, no run recorded: each list says so in its own words, and a week with no recorded value reads as none, never as zero |
| Partial | A part the gateway could not read draws its own unavailable state in its card; the rest stands |
| Read failed | The template's error state, "Home did not load", with Retry, which reads again on the server |
| Slower than 4.5 seconds | The bounded unavailable state, "Home is unavailable", with Retry; never an endless skeleton |
| Signed out since the gate | Sign-in |

## Agents

The assistant reads this page and changes nothing. The page shares its context through `homeContext` in `src/views/home-context.ts`, built from the same read and the same words as the cards, and `view_home` builds the same context from the same response (`GET /home`), so the assistant quotes the figures the screen shows. Ask is in the head row of the paired Featured metric: about the week the cursor points at, or about last week when it points at none.

### What the agent reads

The title; both halves' figures for the last whole week, each with the series its chart draws, week by week, the newest eight, a week with no figure said as `none` and the running week `so far`, and with their findings, every week a tie names; the estimate with its pace, the run coverage and the peak, the four tiles with what each counts, what waits, each open initiative's next move (neighbours with the same next move said once, every slug named), last week's closures, the runs active now and the next milestones. When the cursor rests on a week it says that week's words added and approvals in the caller's name. It says what the words are counted over and what they leave out, that the estimate is not a measurement of anybody's time, and which part could not be read. The whole of it fits the context's budget for both people, so nothing on the page is left to "more is on the page" (Phase 7's second re-review, Work M-9).

```text
- Words added: 15,400 last week, by week: 14 Sept 12,400; 21 Sept none; 28 Sept 8,300; 5 Oct 9,100; 12 Oct 15,400; 19 Oct 2,100 so far.
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address, and the page text after it for anything the context does not cover; `view_home` answers the same text from anywhere in the console, and `explore_home`, offered on this page alone, counts the team's closures, openings, words and runs and the caller's approvals over any window, grouped or a bucket at a time, down to the rows behind them.

### What the agent does here

Protagonist: Words added and approvals in your name.

- "How many words did we add each week this month?" — the words over 30 complete days, a week at a time
- "Which initiatives closed in the last 30 days, and with what outcome?" — the closures over 30 complete days, by outcome
- "How many revisions have I approved each week this quarter, and was each shown to me first?" — the approvals over 90 complete days a week at a time, then by presentation
- "Which skills did our agents run most in the last week?" — the runs over 7 complete days, by skill
- "Archive our team for me." — nothing is asked of the prepared query: the answer names the team's own page, /platform/teams/<slug>, and Archive where the person may open it, and otherwise says archiving a team is not a change they can make; it never says the team was archived

## Surfaces

Console, desktop and phone. Reads `GET /home` on the console's server, as the person, once per request and bounded at 4.5 seconds. It declares no live collection: the week is a whole week's, and the next visit reads it again. The bell beside every page reads Approvals' Waiting (`GET /approvals?tab=waiting`) and follows `initiatives`, the collection an approval changes.
