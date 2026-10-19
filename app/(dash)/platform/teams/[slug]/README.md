# Team

One team, for the superadmin: its people, its open work and lessons, its real-work calls week by week, and who is in it, with the team's administration beside them.

## Structure

- Gate first: the page asks for `teams`, which needs `fleet:read`, before it renders and before its address is read, so a person who does not hold it is answered by the refused page and nothing on the page is read. Its title comes from `gatedMetadata` and its loading state from `gatedLoading`, so under `refusal: 'absent'` neither names the team.
- Masthead: the kicker back to Teams, the slug, and one sentence, drawn before the read answers.
- Tiles: People (with how many are admins), Open work, Waiting (revisions presented and not yet approved) and Lessons adopted, the same figures as the team's row on Teams.
- Calls by week, the page's protagonist: a Column chart of the team's real-work calls, a Monday week a column, the running week drawn unfinished, against the team's own past. Ask is in its head.
- This team: its name, status and created date, and Archive, which asks once more in place and calls the console's existing platform route. An archived team offers no Archive and says how it is restored.
- Members: a table of each person, their role and when they joined, with Remove in each row, and Add member (email and role) above it, each calling the console's existing team settings route. A refusal is said beside the control that made it.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx` while the gate asks `/me`, then the masthead over the tiles', chart's and table's skeletons while the read is under way |
| Default | Tiles, calls by week, the team and its members |
| No such team | "No team called <slug>", with All teams, which opens Teams: the read answered, so it is not the error state |
| No member | "Nobody is in this team", with Add member above it |
| No week recorded yet | The calls card says so; the rest stands |
| Calls by week unavailable | The calls card says they could not be read; the tiles, the team and its members stand |
| Read failed | The error state with the gateway's sentence and Retry |
| Slower than 4.5 seconds | The same error state, saying the read did not answer within 4.5 seconds, with Retry |
| Read again | Retry reads again in the browser, busy only after the person presses it and until that read answers; a read a change starts leaves the state and its Retry where they are, never busy, so a keyboard user keeps their place |
| A write refused | The gateway's sentence beside Add member, beside the row's Remove, or under Archive |

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `teamContext` in `src/views/team-context.ts`, the same function `view_team` calls on the same response, so the assistant quotes the figures the screen shows. Ask is in the head of Calls by week: how the team's real-work calls moved week by week.

### What the agent reads

The team's name, status and created date, its four tiles with what each counts, its calls in the last complete week, then its calls in its last twelve complete weeks at most, oldest first, with the running week so far, and its first twelve members with their roles and when they joined, and how many more. It says that the team is read against its own past and never another team's, that its initiatives are its own to read, and when the calls by week could not be read.

```text
- Real-work calls in the last 5 complete weeks, oldest first: week of 7 Sept 60; week of 14 Sept 0; week of 21 Sept 12; week of 28 Sept 120; week of 5 Oct 80; the week of 12 Oct is still running, 3 so far.
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address, and the page text after it for anything the context does not cover. `view_team` answers the same text from anywhere in the console, and `explore_team`, offered on this page alone, counts the team's real-work calls over any window, every call held to this team.

### What the agent does here

Protagonist: Calls by week.

- "How many real-work calls did this team make in the last 30 days?" — the platform's calls over 30 complete days, held to this team
- "Which tools does this team call most?" — the platform's calls over 30 complete days held to this team, by tool
- "How many of its calls were refused this quarter?" — the platform's calls over 90 complete days held to this team, by whether each was refused

## Surfaces

Console, desktop and phone. Reads `GET /teams/:slug` on the console's server, as the person, once per request and bounded at 4.5 seconds; after a write, and after a change anywhere to the teams collection, the browser reads it again. Live: follows `teams`. Writes `POST` and `DELETE /settings/team/members` and `DELETE /settings/platform/teams`, as Settings did. Its old address, `/teams/<slug>`, is gone and draws the missing page (AC-1.12).
