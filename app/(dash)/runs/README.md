# Runs

Every run your active team recorded since its first, by the skill that drove it, and the latest of them, read on the console's server.

## Structure

- Gate first: the page asks for `runs` before it renders, so a person who does not hold it is answered by the refused page and nothing on the page is read. Its title comes from `gatedMetadata`, so under `refusal: 'absent'` it names nothing; its loading state (`OfferedLoading`) is headed Runs for a person whose own rail offers it, at `/runs` alone, and keeps `gatedLoading`'s words, which name nothing, for anyone else and in the prerendered shell.
- Masthead: the kicker `ZZ Stack · Work`, the title, one sentence, the as-of line (the read's own cutoff) and the skill control (`Every skill`, then each skill the runs hold). The control is drawn before the read answers and narrows the whole page: the tiles, the runs by skill and the recent runs are all the gateway's for that skill.
- Tiles: `Runs` since the first, with the date of the first; `Observed output per run`, with how many runs measured none; `Largest run`, with its skill. Each tile's `About` button says what it counts.
- By skill: each skill's runs, calls per run, share refused, observed output per run and typical length, with how many runs the length rests on when that is not all of them, sorted by observed output per run as the gateway sorted them, a skill nothing measured last. Ask is in its head. A line under it says how many runs were one call and so have no length.
- Recent runs: newest last call first, ten to a page and paged by the gateway, each with its skill, initiative, start, length, calls, observed output and state: `Active` while its last call is within five minutes, `Last call at <time>` after that, or `One call`. No run is ever said to be running.
- A run's bytes are its observed output, the response bytes of its own calls: nowhere on the page are they what a model read, or anything paid for.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx` while the gate asks `/me`, headed Runs for a person whose rail offers it (`OfferedLoading`), then the masthead over the tiles', the by-skill card's and the table's skeletons while the read is under way |
| Default | Everything above |
| Another skill or page on its way | The runs drawn stay, dimmed and marked busy, until the console's server has read the address's |
| Empty | A team with no run: the tiles read `0`, `Not measured` and `None measured`; the by-skill card and the recent runs each say no run is recorded |
| Output nothing measured | `Not measured`, never zero, in the tile, the by-skill card and the recent runs |
| Partial | The by-skill card or the recent runs the gateway could not read draws its own unavailable state with Retry; the rest stands |
| Read failed | "The runs did not load" with the gateway's sentence and Retry, which reads again in the browser |
| Slower than 4.5 seconds | The same, saying the read did not answer within 4.5 seconds; never an endless skeleton |
| Read again | Retry reads again in the browser, busy only after the person presses it and until that read answers; a read a change starts leaves the state and its Retry where they are, never busy, so a keyboard user keeps their place |
| Signed out since the gate | Sign-in |

## Agents

The assistant reads this page and changes nothing. The page shares its context through `runsContext` in `src/views/runs-context.ts`, built from the same read and the same words as the cards, and `view_runs` builds the same context from the same response (`GET /runs?skill&limit&offset`), so the assistant quotes the figures the screen shows. Ask is in the By skill card's head: which skill's runs answer the most observed output, or, with a skill chosen, what its runs show.

### What the agent reads

Whose runs these are, of which skill and since when; the three tiles with what each counts; the time the runs cover with overlapping time counted once, against the summed length, the most at once and the runs of one call; each skill in view by observed output per run, with its runs, calls a run, typical length with what it rests on and share refused; and the recent runs on the page with their initiative and state. It says that observed output is the bytes a run's calls answered, not what a model read and not anything paid for, that a run is active only within five minutes of its last call, how many runs measured no output, and which part could not be read.

```text
- The runs cover 10.4 h, overlapping time counted once, against 10.8 h summed; at most 2 ran at once, and 3 were one call.
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and skill, and the page text after it for anything the context does not cover; `view_runs` answers the same text for any skill and page of recent runs from anywhere in the console, and `explore_runs`, offered on this page alone, counts the team's runs over any window by skill, initiative, weekday or hour, and their observed output by skill or initiative, a day, a week or a month at a time, down to the runs themselves.

### What the agent does here

Protagonist: By skill.

- "Which skill ran most in the last 30 days?" — the runs over 30 complete days, by skill
- "Which skill answered the most observed output this quarter?" — the observed output over 90 complete days, by skill
- "How many runs did each skill have each week this quarter?" — the runs over 90 complete days by skill, a week at a time

## Surfaces

Console, desktop and phone; at 390px the by-skill card is a card list of the skill, its runs and its output per run, and the recent runs one of the skill, initiative, output and state. Reads `GET /runs?skill=…&limit=10&offset=…` for the address's skill and page on the console's server, as the person, once per request and bounded at 4.5 seconds; another skill or page is read there as the navigation renders the page again, and a Retry is read in the browser. Live: follows `runs`, so a run recorded anywhere reads this page again.
