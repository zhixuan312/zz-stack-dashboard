# Record

The active team's record, read on the console's server: what its retained text would take one person to write at the stated pace, as of the read's cutoff, and the work of the period chosen, in six slices.

## Structure

- Gate first: the page asks for `record` before it renders, so a person who does not hold it is answered by the refused page and nothing on the page is read. `record` needs `work:read`, which a member and a superadmin both hold; Record is the active team's for the superadmin too. Its title comes from `gatedMetadata`, so under `refusal: 'absent'` it names nothing; its loading state (`OfferedLoading`) is headed Record for a person whose own rail offers it, at `/record` alone, and keeps `gatedLoading`'s words, which name nothing, for anyone else and in the prerendered shell.
- Masthead: the kicker `ZZ Stack · Work`, the title, one sentence, the as-of line (the read's own cutoff), the period control (Quarter, Year, All; All when the address names none) and `Copy as text`. The control is drawn before the read answers and stays usable while another period is read; `Copy as text` waits for the record it copies.
- The lead, one Featured metric: `One person, writing this · as of <cutoff>`, the hours the retained text would take at the gateway's stated pace, `estimated at <pace> words an hour`, what the words are counted over and what they leave out. It is a stock as of the cutoff, the same in every period, and is labelled so. Under it the words added in the period, a running total (Trend chart), whose caption says it counts every word a revision added with nothing taken off for what a later one removed, so the total can pass the words retained: the figure is a stock, the chart what was added. Ask is in its head. The foot: work closed of opened, documents created, versions written and approvals in your name, for the period.
- Every tile's label is written to stand whole on a quarter-width tile (21 characters at most), and its hint and its line under it say the rest.
- Work: closed by outcome, most open at once, median hours to close, hours to abandon (the median, the span the record's Took column gives each abandoned piece); closures in all (Trend chart), closures by outcome (Column chart with parts), median hours to close (Column chart) and a typical piece of work (Key value).
- Documents: flow documents, versions written, median sources (under a gated document), citations; words added (Column chart: the words each revision added, never net of what a later one removed) and the most rewritten documents (Bar list).
- Knowledge: lessons made, lessons returned, results per search, from the shared shelf; searches with results (Column chart), what searches returned (Bar list), lessons made in all (Trend chart) and lessons adopted, by kind, as of the cutoff (Bar list). One measure, one name: lessons made are those the team's own work made, superseded ones included and an import's left out, as Home's milestone counts them; lessons adopted are those standing on the shelf, imports included, as Knowledge counts them.
- Your agents: observed run coverage, peak concurrency, runs, skills used; weekday by hour (Heatmap of values, drawn once seven days are observed from the later of the period's start and the record's first day, and until then a line saying a whole week is not observed yet) and every day (Heatmap of days from the record's first day, on a quantile scale, a year at a time), both in the reporting time zone and naming the record's first day when the period begins before it, so no hour or day before the record is drawn as 0, and neither is drawn while the record has no first day; and runs by skill (Bar list).
- Firsts and bests: most versions and most sources (each naming its document under the figure), most words in a week and most open at once, each with when it was set; the dated firsts over the whole record.
- The record: every initiative opened before the cutoff, newest first, ten to a page and paged by the gateway (initiative, outcome, opened, closed, took, documents, lessons), with the count by outcome over all of them; a row opens the initiative.
- Every slice is labelled with its period, `This quarter, 1 Oct to 17 Oct`; a chart's periods are weeks up to 26 of them, months up to three years and quarters beyond, as the gateway cuts them, and the chart's title names which, the running one drawn as so far. A tick is the period's first day (`05 Oct`) or its month (`Oct 2026`), never longer than nine characters, so no two run together.
- Nothing on the page is time a person did not spend or a rate of working: the estimate is the time to write the text at the stated pace, and the pace is the gateway's.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx` while the gate asks `/me`, headed Record for a person whose rail offers it (`OfferedLoading`), then the masthead over the lead, a slice's skeleton and the table's while the read is under way |
| Default | Everything above |
| Another period on its way | The record drawn stays, dimmed and marked busy, until the period's arrives; `Copy as text` waits for it |
| Empty | A team with nothing recorded: each chart says nothing is recorded in the period, each list says so in its own words, and a figure with no value reads `None recorded`, never zero |
| Partial | A slice the gateway could not read draws its own unavailable state; the lead with no estimate reads `Unavailable`; the rest stands |
| Read failed | "Record did not load" with the gateway's sentence and Retry, which reads again in the browser |
| Slower than 4.5 seconds | The same, saying the platform did not answer within 4.5 seconds; never an endless skeleton |
| Read again | Retry reads again in the browser, busy only after the person presses it and until that read answers; a read a change starts leaves the state and its Retry where they are, never busy, so a keyboard user keeps their place |
| Signed out since the gate | Sign-in |

## Agents

The assistant reads this page and changes nothing. The page shares its context through `recordContext` in `src/views/record-context.ts`, built from the same read and the same words as the cards, and `view_record` builds the same context from the same response (`GET /record?period`), so the assistant quotes the figures the screen shows. `Copy as text` copies the same words through `recordText` in `src/console/record-text.ts`. Ask is in the lead's head: about the period chosen.

### What the agent reads

The period with its dates, the lead with its pace and what its words are counted over, the foot, each slice's four figures with the line under each, the record's count by outcome, the dated firsts, the most rewritten documents, the runs by skill with how many skills and runs the list does not name, and the lessons adopted by kind. It says that the lead is a stock as of the cutoff and an estimate, never a measurement, and which slice could not be read.

```text
- One person, writing this: 575 h, estimated at 500 words an hour, as of 17 Oct 2026, 14:00. (Over 287,400 words your documents and lessons retain as of 17 Oct 2026, 14:00: the time one person would take to write them at that pace: an estimate, not a measurement.)
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and period, and the page text after it for anything the context does not cover; `view_record` answers the same text for any period from anywhere in the console, and `explore_record`, offered on this page alone, counts the team's closures, words, lessons and runs and the caller's approvals over any window, grouped or a bucket at a time, down to the rows behind them.

### What the agent does here

Protagonist: One person, writing this.

- "How many pieces of work did we close each month this quarter, and with what outcome?" — the closures over 90 complete days a month at a time, then by outcome
- "Which documents gained the most words in the last 30 days?" — the words over 30 complete days, by document
- "How many lessons of each kind did we adopt this quarter?" — the lessons over 90 complete days, by kind
- "Which skills did our agents run most, and at what hours?" — the runs over all complete days, by skill, then by hour
- "How many revisions have I approved each week this quarter?" — the approvals over 90 complete days, a week at a time

## Surfaces

Console, desktop and phone; at 390px the record's table is a card list of the initiative, its outcome, when it opened and how long it took. Reads `GET /record?period=…&limit=10&offset=…` for the address's period and page on the console's server, as the person, once per request and bounded at 4.5 seconds; another period, another page of the record and a Retry are read in the browser. It declares no live collection: the record is as of its cutoff, and the next visit reads it again.
