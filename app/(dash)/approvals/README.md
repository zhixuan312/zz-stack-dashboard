# Approvals

What waits on the active team for a decision, and every approval recorded in your name there, with what the record holds of how each revision was shown and decided, read on the console's server.

## Structure

- Gate first: the page asks for `approvals` before it renders, so a person who does not hold it is answered by the refused page and nothing on the page is read. It needs `work:read`, which a member and a superadmin both hold. Its title comes from `gatedMetadata`, so under `refusal: 'absent'` it names nothing; its loading state (`OfferedLoading`) is headed Approvals for a person whose own rail offers it, at `/approvals` alone, and keeps `gatedLoading`'s words, which name nothing, for anyone else and in the prerendered shell.
- First read on the console's server: the address's tab and page are read as the person, bounded at 4.5 seconds, and handed to the page with the team the person acts for. A tab or a page moves the address and the server reads it again; the browser waits for that answer rather than asking beside it, and keeps the tiles and the weeks drawn meanwhile. Later reads, after an approval or a hint, are the browser's.
- Masthead: the kicker `ZZ Stack · Work`, the title, one static sentence and the as-of line, the read's own `meta.asOf`.
- The Records template. Four tiles over both lists, whatever the tab: Waiting now (the team's revisions presented and not yet approved, each once, with how many have waited longer than 14 days), Oldest wait (how long the revision presented longest ago has waited, and when it was presented; `None waiting` when nothing is), Approvals in your name (every approval recorded in your name in this team; a teammate's are never counted) and No presentation recorded (N, with `of M known, U unknown` on its one line: M the approvals whose review context is recorded, U the rest of the approvals in your name, so the two tiles add up). A tile whose list could not be read reads `Unavailable`, never zero.
- The tabbed table, the page's protagonist, straight under the tiles so it starts above the fold at 1440px; then the approvals in your name by week: a Column chart, a Monday week each from the week of your first approval, at most 26, the running week drawn unfinished, its axis naming whole counts only (a scale of one approval steps by halves, and that line goes unnamed).
- Two tabs, Waiting and History, drawn with `LinkTabs` in the table's head: each is an address of its own (`/approvals`, `/approvals?tab=history`), so the back button works and a tab can be linked to, and each carries its list's total.
- Waiting, labelled `Team approvals`: nothing records who must decide a revision, so the queue is the team's and no row is assigned to anybody. Document, initiative, version with its content revision's short hash (its first eight characters, the whole token on hover), waiting since, and Review, which opens the document's page, where the revision waiting is the one shown: the queue holds only a document's current revision, and the document's page reads it.
- History, labelled `Approved in your name`, with `N of M approved with no presentation recorded, and U unknown` in its head: document, initiative, version and the content revision's short hash, approved at (the day alone, marked `Day only`, for a revision sealed before approvals were recorded as events), presentation and decision basis, each as the gateway classified it, its definition on hover. Presentation reads `Shown in the console`, `Covered in an agent's context`, `Not recorded` or `Unknown`; decision basis `Explicit, recorded`, `Standing delegation, recorded` or `Unknown`. Nothing on the page says you read a revision or signed it at the keyboard: the record names you as the signer, and that is all it says.
- At 390px a History row is a card: the document, then the initiative and when, then how it was shown on a line of its own; no line of it starts with a separator.
- Each column is as wide as what it holds: the file name, the initiative, and History's presentation and decision basis each on one line, the initiative taking the rest of the row.
- The Waiting now tile's figure is ink like the others: the accent is kept for what a person presses.
- Ten rows a page in each tab, paged by the gateway. A Waiting row opens the revision waiting; a History row opens its document at its current revision, which may be later than the one approved, and the document's version chain lists the one approved. No evidence or basis is worked out in the browser; only how long a revision has waited is told from the read's cutoff.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx` while the gate asks `/me`, headed Approvals for a person whose rail offers it (`OfferedLoading`), then the masthead over four tile skeletons, the table's and the chart's while the read is under way |
| Default | The tiles, the tabs with their totals and a page of Waiting, then the weeks |
| History | The same tiles, a page of the approvals in your name, and the same weeks, read on the console's server for the new address |
| A new tab or page on its way | The tiles and the weeks as drawn; the rows of the same tab quieter, or the table's skeleton for the other tab |
| Nothing waits | `None waiting`, and "Nothing waits for approval" |
| No approval in your name | Zero, `of 0 known` under the fourth, the chart's "No approval in your name yet", and History's empty state |
| Waiting unavailable | Waiting now and Oldest wait read `Unavailable`; Waiting's table says the queue could not be read; History and its figures stand |
| History unavailable | Approvals in your name and No presentation recorded read `Unavailable`, the chart says it could not be read, History's table says so; Waiting stands |
| Read failed | Each tile a dash, and the table's error state with the gateway's sentence and Retry |
| Slower than 4.5 seconds | The same error state, saying the read did not answer within 4.5 seconds, with Retry; never an endless skeleton |
| Read again | The table's Retry reads again in the browser, busy only after the person presses it and until that read answers; a read a change starts leaves the error state and its Retry where they are, never busy, so a keyboard user keeps their place |
| Refused | The refused page, under the same title and loading state as an address that names nothing |

## Agents

The assistant reads this page and approves nothing: a person approves a revision with Approve on the document's own page, after reading it there, and the context says so. The page shares its context through `approvalsContext` in `src/views/approvals-context.ts`, the same function `view_approvals` calls on the same response, so the assistant quotes the figures the screen shows. Ask, labelled, is beside the line under the tabs that says what the tab lists, inside the card, and asks about that list.

### What the agent reads

The tab and its page, the four tiles with what each counts, then the tab's own summary (Waiting: how many revisions wait and how many longer than 14 days, by initiative; History: the approvals in your name by presentation and by decision basis), the first five rows in view (fewer where names are long) with their exact version and content revision and, for History, when each was approved and its evidence, and how many more the page shows, then the other tab's summary and the last four whole weeks of approvals in your name, the first to go when the context is over its 2,400-character budget. It says that the assistant approves nothing, that the queue is the team's, that `Approved in your name` means the record names you as the signer and nothing more, what a presentation class does not prove, from when presentations are recorded, and which list could not be read.

```text
- Rows 1 to 10 of 11, newest first: review.md of 2026-10-08-result-explanations, v1 (cr_…), 17 Oct 2026, 09:00: shown in the console; basis explicit, recorded; …
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `view_approvals` answers the same text from anywhere in the console, the waiting tab unless another is named, and `explore_approvals` (`src/views/approvals-explore.ts`), offered on this page alone, counts the approvals in your name over any window, by presentation, decision basis or initiative, down to each approval.

### What the agent does here

Protagonist: Approvals.

- "How many of my approvals in the last 90 days had no presentation recorded?" — the approvals in your name over 90 complete days, by presentation
- "How many of my approvals were made under a standing delegation this quarter?" — the approvals in your name over 90 complete days with decision basis standing_delegation_recorded, down to each approval
- "Which initiatives took the most approvals from me in the last 30 days?" — the approvals in your name over 30 complete days, by initiative
- "How have my approvals moved week by week this quarter?" — the approvals in your name over 90 complete days, a week at a time

## Surfaces

Console, desktop and phone; at 390px a row is a card of its document, its initiative, when it waited since or was approved, and Review. Reads `GET /approvals?tab=waiting|history&limit=10&offset=…` on the console's server, as the person, once per request and bounded at 4.5 seconds. Live: follows `initiatives`, under which the stream keeps `/approvals`, so an approval made anywhere reads this page again.
