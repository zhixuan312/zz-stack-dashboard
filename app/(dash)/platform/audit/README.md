# Audit

The superadmin's Audit: every recorded act of administration said in one sentence, and every recorded event behind it as metadata, read on the console's server.

## Structure

- Gate first: the page asks for `audit` before it renders, so a person who does not hold it is answered by the refused page and nothing on the page is read. `audit` needs `fleet:read`, which only a superadmin holds: a member is answered at this address exactly as at an address no page answers. Its title comes from `gatedMetadata`, so under `refusal: 'absent'` it names nothing for a member; its loading state (`OfferedLoading`) names the page only for a person whose own rail offers Audit, at this address, and keeps `gatedLoading`'s words, which name nothing, for anyone else and in the prerendered shell.
- Masthead: the kicker `ZZ Stack · Platform`, the title, one static sentence and the as-of line, the read's own `meta.asOf`. The masthead is drawn before the read answers.
- Two tabs, Administration and Everything, each its own address (`?filter=all` is Everything) and its own read. Moving to a tab starts it afresh: its filters cleared, its first page.
- Administration, the page's protagonist: ZZ Meridian's Activity feed, one act a line, newest first, ten a page. Each line is the gateway's own sentence, filled from one fixed template per kind; the console writes none. The actor is the sentence's first words, `Someone not recorded` when nobody was, and the line's mark is the person's initials, or the platform's dot for an act whose origin is `platform` alone. The feed's agent mark (`via`) is never set: no event records an agent acting for a person. An act made in the console says so, because the gateway says so; no other channel is recorded, so none is named. The times are told against the read's cutoff. Ask is in the card's head.
- Under the feed, the acts of administration that leave no event, named from the read (`notRecorded`): knowledge reindex, knowledge reconcile, client setup, plugin registration and release record.
- Everything: the event table, every recorded event but page views, as metadata (when, kind, team, actor, subject, result, origin and channel), the latest 500 within the filters, newest first, ten a page. A refusal names who it is put down to; an actor nobody recorded reads `Not recorded`; a channel that is not the console reads `Not recorded`, never a door or a script. Its filters are kind, team and a day the events came before (the first of each month since the record began), each read by the gateway before its ceiling of 500, so a narrow filter or an earlier day reaches events older than the latest 500. Kind offers every act a template says, `tool_call`, and every kind the page names; team every team the page names. Ask is in the table's filter bar.
- Nothing here writes, and nothing leaves the gateway but metadata: no document or lesson body, label, title, file name, search question or refusal text.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx` while the gate asks `/me`, headed Audit for a person whose rail offers it (so a press in the rail lands on the heading at once), then the masthead over the tab strip and the feed's skeleton while the read is under way |
| Administration | The acts of the page, newest first, with the pager past ten, and the acts Audit cannot show |
| Everything | The page of events, the filters and their count, `the latest 500` beside it at the ceiling |
| A tab, a filter or a page moved | The table's or the feed's loading state, until the console's server has read the new address |
| Nothing recorded | "No act of administration recorded yet", or Everything's "Nothing recorded yet" |
| No event matches the filters | The table's filtered empty state with Clear filters |
| Read failed | The feed's error state with the gateway's sentence and Retry, or the table's on Everything |
| Slower than 4.5 seconds | The same error state, saying the read did not answer within 4.5 seconds, with Retry; never an endless skeleton |
| A member | The refused page, which names nothing, under a title and a loading state that name nothing |

## Agents

The assistant reads this page and changes nothing. The page shares its context through `auditContext` in `src/views/platform-audit-context.ts`, the same function `view_audit` calls on the same response, so the assistant quotes what the screen shows.

### What the agent reads

The tab in force and its filters, how many acts or events it reached (up to the latest 500) and when the record begins, then the first five of the page: on Administration each act's sentence as the feed draws it, with when; on Everything each event's kind, subject, team, actor, result, origin and whether it was made in the console. It says that how an act arrived is not recorded, that an actor nobody recorded is not guessed, that events are metadata only, which acts leave no event, where the read stops at its ceiling, and how many more are on later pages.

```text
- The acts on this page, newest first: ava.lindqvist@example.com added maximiliana.fitzgerald-oyelaran@example.com to atlas as member in the console (17 Oct 2026, 21:52); …
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `view_audit` answers the same response from anywhere in the console, with `filter` `administration` or `all` and the route's own `limit` and `offset`, and `explore_audit` (`src/views/audit-explore.ts`), offered on this page alone, counts the recorded events by kind and team over any window and drills to the events themselves, metadata only.

### What the agent does here

Protagonist: Administration.

- "How many people were deactivated in the last 90 days?" — the events over 90 complete days with kind admin.deactivate_person, down to each event
- "Which kinds of event did beacon record most in the last 30 days?" — the events over 30 complete days with team beacon, by kind
- "How many team switches were made each week this month?" — the events over 30 complete days with kind team.switch, a week at a time
- "On which weekdays is administration done?" — the events over 90 complete days, by weekday

## Surfaces

Console, desktop and phone; at 390px the feed keeps one line an act and the table is a card list of the kind, when, the actor and the result. Reads `GET /platform/audit?filter=administration|all&kind=&team=&before=&limit=10&offset=…` on the console's server, as the person, once per request and bounded at 4.5 seconds; a tab, a filter or another page moves the address and is read on the server again. `before` is sent as the instant the chosen day began in the reporting time zone. It declares no live collection: the next visit reads what was recorded since.
