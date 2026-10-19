# Evaluation

Each plugin's evaluation as the platform recorded it: what waits for a decision, which latest scores are established, when a plugin was last scored, every score in the series it compares within, and the findings by decision and by owner, read on the console's server. Both roles open it; a superadmin reads the protocols' and measures' keys and each waiting finding's own words, a member the form everybody may read.

## Structure

- Gate first: the page asks for `evaluation`, which needs `platform:read`, before it renders, so a person who does not hold it is answered by the refused page and nothing on the page is read. Every role holds `platform:read`, so a member and a superadmin both open it. Its title comes from `gatedMetadata`, so under `refusal: 'absent'` it names nothing; its loading state (`OfferedLoading`) is headed Evaluation for a person whose own rail offers it, at `/platform/evaluation` alone, and keeps `gatedLoading`'s words, which name nothing, for anyone else and in the prerendered shell.
- Masthead: the kicker `ZZ Stack · Platform`, the title, one static sentence and the as-of line (the read's own `meta.asOf`), drawn before the read answers.
- Tiles: Findings waiting (defects and unknowns with no decision yet, with how long the oldest has waited; `Nothing waits for a decision` when none does), Scores established (plugins whose latest scoring is established, of how many were scored), Last scored (the day, `Never` when no plugin has been scored) and Days scored (distinct days in the reporting time zone on which a plugin was scored, since the first scoring). No tile is ever a zero standing in for a figure the read does not have.
- Each plugin's latest score, the page's protagonist: one row a plugin, its score out of 10 with its range under it (a scoring with no score reads `No score`, never 0), the protocol it was scored against under the plugin's name (its key and version for the superadmin, `Protocol v<n>` for a member), its score out of 10 with its range under it, its standing (established, provisional or not established), whether the guardrails held, and the day. Every column but the plugin holds its values whole on one line, so the figures never wrap into towers and a key never breaks mid-word; under 896px the guardrails give way to the phone card. Ask is in the table's head.
- Every score, by series: one row a series, which is one protocol version and one population. Each row names its plugin, with the read's own statement of whether that plugin's series compare said once, on its first row (`Comparable: one protocol version and population`, or `Not comparable:` with the recorded reason); the series, by its protocol with its population under it, each on one line, so the column is as wide as the longer of the two and the plugin's column keeps only the slack; every scoring of the series oldest first, each its score and range over its standing and day; and, within the series alone, a Sparkline of its scores and the change from its first score to its last, in points, in ink: a movement, not a verdict. A series with one scoring, or with under two scores, draws no trend, and no line or change is ever drawn across two series. Whether series compare is the read's statement, never the page's.
- Findings by decision (Composition bar): every defect and unknown recorded, each counted once, as applied, rejected or deferred, the deferred being those still waiting; strengths have no decision and are not counted.
- Findings by owner (Bar list): the same findings by the owner category each blames (the plugin, a dependency, the platform, the environment, user input, not known), most first.
- Findings waiting: the defects and unknowns with no decision yet, oldest first, ten to a page, each named by what it found as far as its reader may read it. The superadmin's row leads with the pattern the evaluation recorded, the measure it was found on under it, then the plugin, the kind, the owner category (under 896px it gives way) and how long it has waited. A member reads neither the pattern nor the measure, which are the owning team's words: their row leads with the gateway's fixed name, its kind, plugin and owner category (`A defect in sdlc, owned by the plugin`), or the spec's own sentence, `Evaluation finding awaiting a decision`, when its owner category is not a public one, with the plugin under it; then the kind and how long it has waited, with no column repeating what the name says.
- No write control: nothing here starts an evaluation, scores a plugin or decides a finding. Those are zz-plugin-eval's tools. Every figure is the gateway's: the browser counts, compares and ranks nothing.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx` while the gate asks `/me`, headed Evaluation for a person whose rail offers it (`OfferedLoading`), then the masthead over four tile skeletons, the three tables' and the two compositions' while the read is under way |
| Default | Every card above |
| A member | The same cards; protocols read `Protocol v<n>`, the waiting findings are named by their kind, plugin and owner category, with no pattern and no measure |
| No plugin scored yet | `Never`, no score established, "No plugin scored yet", "No score recorded yet", and the compositions' and the waiting findings' empty states |
| Nothing waiting | The tile reads 0 with `Nothing waits for a decision`, and so does the list |
| A part unavailable | That card says it could not be read and why; every other card stands, the Ask with its table |
| Read failed | The error state with the gateway's sentence and Retry, which asks the server again |
| Slower than 4.5 seconds | The same error state, saying the read did not answer within 4.5 seconds, with Retry; never an endless skeleton |

## Agents

The assistant reads this page and changes nothing. The page shares its context through `evaluationContext` in `src/views/platform-evaluation-context.ts`, built from the same read and the same words as the page, and `view_evaluation` builds the same context from the same response (`GET /platform/evaluation`), so the assistant quotes the figures the screen shows. Ask is on each plugin's latest score: which scores can be relied on, which guardrails failed and what still waits.

### What the agent reads

The four tiles with what each counts, the findings by decision as the composition labels them (`Applied 1; Rejected 1; Deferred, waiting 2`) and by owner. What code found, one line a plugin: its latest scoring with its range, standing and guardrails, then its series with the read's statement of whether they compare, every scoring of each series and the change within a series that holds two scores or more; then the findings waiting, oldest first, the first five (with each one's measure and pattern, whole, for the superadmin; for a member a finding named by the spec's sentence with its kind and plugin). When the budget is tight the findings waiting go first (their count stays a fact), then the last plugins' lines, and the context says the page shows more. It says that a change is stated within a series and never across two, that a score not established is not a number to quote, that strengths are not counted, that no score is combined into an overall one, and, for a member, that the protocol's and measure's keys and a finding's own words are the owning team's.

```text
- sdlc: latest 7.1 of 10 (6.5 to 7.7), established, guardrails held; by series, not comparable: a different protocol version: sdlc-flow-quality v1, the surface recorded at that version: 5.8 provisional 21 Sept | sdlc-flow-quality v2, the surface recorded at that version: 6.4 established 04 Oct, 7.1 established 15 Oct; up 0.7 points within the series.
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address, and the page text after it for anything the context does not cover; `view_evaluation` answers the same text from anywhere in the console, and `explore_evaluation` (`src/views/evaluation-explore.ts`), offered on this page alone, counts the findings by decision, owner category or plugin, a week or a month at a time, down to each finding still waiting in the caller's form, and the plugins whose latest scoring is established, down to that scoring.

### What the agent does here

Protagonist: Each plugin's latest score.

- "How were the findings made in the last 90 days decided?" — the findings over 90 complete days, by decision
- "Which owner category do this quarter's findings blame most?" — the findings over 90 complete days, by owner
- "Which findings on sdlc are still waiting for a decision?" — the findings over all complete days with plugin sdlc and decision deferred, down to each finding
- "Which plugins had an established score in the last 30 days?" — the scores established over 30 complete days, by plugin, down to each plugin's latest scoring
- "How many findings were made each month this year?" — the findings over all complete days, a month at a time

## Surfaces

Console, desktop and phone; at 390px each table is a card list: a plugin with its standing and one sentence of its score, guardrails and day (`No score, guardrails not established, scored 13 Oct`), which wraps as words, so no line opens with a separator; a series with its plugin and statement, its protocol, how many scorings it holds and its trend; a finding with its name, kind and how long it has waited, and the superadmin's with its plugin. Reads `GET /platform/evaluation` on the console's server, as the person, once per request and bounded at 4.5 seconds; nothing is cached across callers. It declares no live collection: a scoring or a decision is recorded through zz-plugin-eval, and the next visit reads it.
