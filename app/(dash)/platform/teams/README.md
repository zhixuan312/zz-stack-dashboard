# Teams

Every team on the platform, each against its own past weeks: the superadmin's list of who is in each team, what it has open and waiting, what it has settled, and how its real-work use has moved.

## Structure

- Gate first: the page asks for `teams`, which needs `fleet:read`, before it renders, so a person who does not hold it is answered by the refused page and nothing on the page is read. Its title comes from `gatedMetadata`, so under `refusal: 'absent'` it names nothing; its loading state (`OfferedLoading`) is headed Teams for a person whose own rail offers it, at `/platform/teams` alone, and keeps `gatedLoading`'s words, which name nothing, for anyone else and in the prerendered shell.
- Masthead: the kicker `ZZ Stack · Platform`, the title, one sentence, the as-of line (the read's own `meta.asOf`) and Create a team, the page's one action. The masthead is drawn before the read answers.
- The release's Records template. Four tiles over every team, whatever the filters: Teams, Open work, Pending revisions (revisions presented and not yet approved, each once) and Lessons adopted.
- The table, the page's protagonist: team (slug, its name, Archived when it is), people, open work, waiting, lessons, sessions by week as a neutral Sparkline (the accent is for actions), calls last week and the week before (`No data` for a week before the team's record began, `Unavailable` only for one that could not be read), and last active (`No activity yet` for a team that never made a real-work call). Ten rows a page, latest real-work call first, filtered and paged by the gateway; a row opens the team's page.
- Filter bar: search on the slug or the name, and status, kept in the address with the page. Ask is in the filter bar.
- Create a team: a dialog with the slug and the name, calling the console's existing platform route; the gateway's refusal is said under the fields and the dialog keeps what was typed.
- Every figure is the read's, and a team is drawn against its own past only: no column ranks, totals or compares one team with another.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx` while the gate asks `/me`: the shell's own skeleton, the body an address no page answers draws, headed Teams for a person whose rail offers it (`OfferedLoading`); then the masthead over four tile skeletons and the table's skeleton while the read is under way |
| Default | The tiles, then a page of teams |
| No team yet | The tiles at zero and "No team yet", pointing at Create a team |
| Filtered to nothing | "No teams match these filters" with Clear filters; the tiles still count every team |
| Calls by week unavailable | The rows and tiles stand; each team's sessions and calls read `Unavailable`, never zero |
| Read failed | Each tile a dash, and the table's error state with the gateway's sentence and Retry |
| Slower than 4.5 seconds | The same error state, saying the read did not answer within 4.5 seconds, with Retry; never an endless skeleton |
| Read again | The table's Retry reads again in the browser, busy only after the person presses it and until that read answers; a read a change starts leaves the error state and its Retry where they are, never busy, so a keyboard user keeps their place |
| Create refused | The gateway's sentence under the dialog's fields |

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `teamsContext` in `src/views/teams-context.ts`, the same function `view_teams` calls on the same response, so the assistant quotes the figures the screen shows. Ask is in the filter bar: how each listed team's real-work use has moved against its own past weeks.

### What the agent reads

The filters and the page in force, the four tiles with what each counts, how many teams match, then each team on the page (up to ten, each whole and as many as fit, and how many more) with its people, open work, waiting, lessons, its calls the week before last and last week, and the day of its last real-work call. It says that each team is read against its own past and never ranked against another, that the assistant changes no team (a person creates one with Create a team here, and archives one or adds and removes its members with Archive, Add member and Remove on the team's own page, `/platform/teams/<slug>`), that people counts memberships, that the running week is not complete, when the calls by week could not be read, and how many more teams match on later pages. It is dated with the read's own cutoff, as the masthead prints it (`As of 20 Oct 2026, 03:15.`), never the moment the data arrived in the browser.

```text
- The teams on this page, latest real-work call first, each with its real-work calls in the weeks of 28 Sept and 5 Oct: atlas (Atlas Research): 4 people, 8 open, 3 waiting, 5 lessons, calls 120 then 80, active 14 Oct 2026; …
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `view_teams` answers the same text from anywhere in the console, and `explore_teams`, offered on this page alone, counts the teams by status and the platform's real-work calls by team over any window.

### What the agent does here

Protagonist: Teams.

- "How many teams are active, and how many archived?" — the teams, by status
- "How have atlas's real-work calls moved week by week this quarter?" — the platform's calls over 90 complete days held to the team atlas, a week at a time
- "Which tools does beacon call most?" — the platform's calls over 30 complete days held to the team beacon, by tool
- "Which teams were made in the last 90 days?" — the teams made by the end of 90 complete days, down to each team with its page

## Surfaces

Console, desktop and phone; at 390px the table is a card list of the team, its people, its open work and when it was last active, or `No activity yet`. Reads `GET /teams?limit=10&offset=…` with the address's filters on the console's server, as the person, once per request and bounded at 4.5 seconds; a later page, a filter and a change anywhere to the teams collection are read in the browser. Live: follows `teams`. Writes `POST /settings/platform/teams`, as Settings did. Its old address, `/teams`, is gone and draws the missing page (AC-1.12).
