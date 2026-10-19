# People

Everybody the platform knows: the superadmin's list of each person's role, teams, passkeys, last recorded sign-in and state, where a person is added, given an enrolment link and deactivated.

## Structure

- Gate first: the page asks for `people`, which needs `fleet:read`, before it renders, so a person who does not hold it is answered by the refused page and nothing on the page is read. Its title comes from `gatedMetadata`, so under `refusal: 'absent'` it names nothing; its loading state (`OfferedLoading`) is headed People for a person whose own rail offers it, at `/platform/people` alone, and keeps `gatedLoading`'s words, which name nothing, for anyone else and in the prerendered shell.
- Masthead: the kicker `ZZ Stack · Platform`, the title, one sentence, the as-of line (the read's own `meta.asOf`) and Add a person, the page's one action. The masthead is drawn before the read answers.
- The release's Records template. Four tiles over everybody, whatever the filters: People, With a passkey, Never signed in (active people with no sign-in recorded) and Sign-ins last week (the last complete Monday week, `Unavailable` when it could not be counted and `No data` before the record began, never zero).
- The table, the page's protagonist: person (name and email), role, teams (`<slug> (<role>)`, every membership), passkey, last sign-in and state, and each active person's two acts. Ten rows a page, by the day a person was added, filtered and paged by the gateway. A person with no sign-in on record reads `No sign-in recorded`, never a date.
- Filter bar: search on the email or the name, and state, kept in the address with the page. Ask is in the filter bar.
- Add a person: a dialog with the email and an optional display name, calling the console's existing platform route; the gateway's refusal is said under the fields and the dialog keeps what was typed. Adding a person lets nobody in: the passkey attaches through an enrolment link.
- Enrolment link, in an active person's row: issued by the console's existing route and shown once, in a dialog portalled outside the page and marked `data-assistant="omit"`, so the page text the assistant reads never holds it.
- Deactivate, in an active person's row, behind an inline confirmation; the gateway's sentence is the toast, and a refusal is said beside the buttons in that row.
- Every figure is the read's, and nothing compares one person with another.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx` while the gate asks `/me`, headed People for a person whose rail offers it (`OfferedLoading`), then the masthead over four tile skeletons and the table's skeleton while the read is under way |
| Default | The tiles, then a page of people |
| Nobody yet | The tiles at zero and "Nobody yet", pointing at Add a person |
| Filtered to nothing | "No people match these filters" with Clear filters; the tiles still count everybody |
| Sign-ins unavailable | The rows and the other tiles stand; Sign-ins last week reads `Unavailable` |
| Read failed | Each tile a dash, and the table's error state with the gateway's sentence and Retry |
| Slower than 4.5 seconds | The same error state, saying the read did not answer within 4.5 seconds, with Retry; never an endless skeleton |
| Read again | The table's Retry reads again in the browser; a read a change starts leaves the error state and its Retry where they are, so a keyboard user keeps their place. The managed table's Retry is never busy |
| A write refused | Add's refusal under its fields; an enrolment link's or a deactivation's beside the buttons in its row |

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `peopleContext` in `src/views/people-context.ts`, the same function `view_people` calls on the same response, so the assistant quotes the figures the screen shows. Ask is in the filter bar: who has never signed in, and how many people signed in last week.

### What the agent reads

The filters and the page in force, the four tiles with what each counts, how many people match, then each person on the page by name and state alone. It says that addresses, tokens and enrolment links are not part of the context, that the assistant changes nobody (a person adds someone with Add a person here, and issues an enrolment link or deactivates someone with Enrolment link or Deactivate in their row), that a person with no sign-in on record is unknown rather than a date, when the sign-ins could not be counted, and how many more people match on later pages.

```text
- The people on this page, by the day they were added, each with their state: Ava Lindqvist (active); Leo Santos (deactivated); …
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover, never the enrolment link. `view_people` answers the names and states of the read from anywhere in the console, and `explore_people`, offered on this page alone, counts the people by role and state and the recorded sign-ins by role over any window.

### What the agent does here

Protagonist: People.

- "How many people are on the platform, and how many are deactivated?" — the people, by state
- "How many superadmins are there?" — the people held to the role superadmin
- "How many sign-ins did superadmins and members make each week this month?" — the sign-ins over 30 complete days a week at a time, then by role
- "Who signed in in the last week?" — the sign-ins over 7 complete days, down to the people who signed in
- "Deactivate Mei Tanaka for me." — nothing is asked of the prepared query: the answer names /platform/people and Deactivate in that person's row, where the person deactivates them, and says the assistant deactivated nobody

## Surfaces

Console, desktop and phone; at 390px the table is a card list of the person, their acts, and their passkey, last sign-in and state. Reads `GET /people?limit=10&offset=…` with the address's filters on the console's server, as the person, once per request and bounded at 4.5 seconds; a later page, a filter, a write and a change anywhere to the people collection are read in the browser. Live: follows `people`. Writes `POST /settings/platform/people`, `DELETE /settings/platform/people` and `POST /settings/platform/enrolments`, as Settings did. Its old address, `/people`, is gone and draws the missing page (AC-1.12).
