# Bug report

One bug report, the superadmin's alone: what the reporter wrote, what it is about, what was decided, and, while it is open, the form that resolves it, read on the console's server.

## Structure

- Gate first: the page asks for `bug`, which needs `fleet:read`, before it renders and before its address is read, so a member is answered by the refused page and nothing on the page is read for them. Its title comes from `gatedMetadata` and its loading state from `gatedLoading`, so under `refusal: 'absent'` neither names a report.
- The reads come before the masthead: the report and its duplicate targets, together. An id that names no report is answered by the missing page, exactly as an address that names nothing is.
- Masthead: the kicker back to Bugs, `Bug report`, and one sentence.
- Report, the page's protagonist: the reporter's title and words as filed, drawn as plain text. Ask is in its head.
- This report: its impact, surface (`None named` when none is), team (`No team`), the version it was filed against (`Not recorded`), when it was filed, and when it was resolved.
- Decision, once it is closed: the outcome, what was decided and why, and the report it duplicates as a link to that report's page. A closed report is not reopened.
- Resolve, while it is open: the outcome (fixed, not a bug, duplicate), what was decided and why (required), and for a duplicate the report it duplicates, chosen from the duplicates read alone, which are the other reports of its team. Resolve report stays disabled until the outcome, the reasoning and, for a duplicate, the target are given. The form posts `bug_resolve`'s arguments, `{ status, resolution }` or `{ status: 'duplicate', resolution, duplicate_of }`, to `POST /api/console/platform/bugs/:id/resolve`, the console's write path under the session cookie. A refusal, a 409 for a report already closed among them, keeps what was typed and says the gateway's sentence under the form. Nothing on the page deletes a report.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx` while the gate asks `/me` and the reads are under way: the report's and its facts' cards, then the form's, as skeletons |
| Open | The report, its facts and the resolve form |
| Closed | The report, its facts and the decision |
| No duplicate target | The duplicate outcome disabled, saying no other report of its team exists |
| Duplicate targets unavailable | The duplicate outcome disabled, with the read's sentence; fixed and not a bug stand |
| Resolve refused | The form keeps what was typed, and says the gateway's sentence |
| Resolved | A confirmation, and the report and its targets read again: the decision replaces the form |
| No such report | The missing page, from the server's read; from a later read in the browser, "No report of this id is recorded" with All reports |
| Read failed | The error state with the gateway's sentence and Retry |
| Slower than 4.5 seconds | The same error state, saying the read did not answer within 4.5 seconds, with Retry |

## Agents

The assistant reads this page and changes nothing: a report is resolved on its page, by a person. The page shares its context through `bugContext` in `src/views/platform-bugs-context.ts`, the same function `view_bug` calls on the same responses, so the assistant quotes what the screen shows.

### What the agent reads

The report's status, impact, surface, team, version and when it was filed and resolved, its title and the reporter's words, cut to what holds the budget, what was decided, and, while it is open, the reports of its team it may be closed as a duplicate of. It says that the assistant changes nothing, that a closed report is not reopened, and that a duplicate is read within one team's reports.

```text
- It may be closed as a duplicate of 2 reports of its team: Approve answers twice when the button is pressed twice (duplicate, 0b3f2a6e-…-1d02); …
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address, and the page text after it for anything the context does not cover. `view_bug` answers the same text from anywhere in the console, and `explore_bug` (`src/views/bugs-explore.ts`), offered on this page alone, asks what Bugs' prepared query asks: the route has no dimension of a report's id, so nothing in it is held to this report.

### What the agent does here

Protagonist: Report.

- "How many other reports on this surface were filed in the last 30 days?" — the reports filed over 30 complete days with this report's surface, down to each report
- "How were the reports that block work resolved in the last 90 days?" — the reports resolved over 90 complete days with impact blocks_work, by outcome
- "How many reports are still open from the last 90 days?" — the reports filed over 90 complete days with state open
- "Resolve this report for me." — nothing is asked of the prepared query: the answer names this page and Resolve report under Resolve, where the person resolves it, and says the assistant resolved nothing

## Surfaces

Console, desktop and phone. Reads `GET /platform/bugs/:id` and `GET /platform/bugs/:id/duplicates` on the console's server, as the person, once per request and bounded at 4.5 seconds; a Retry or a resolution reads them again in the browser. It declares no live collection.
