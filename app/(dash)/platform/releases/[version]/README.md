# Release

One release: its published changelog and upgrade notes, what clients must do, and what was observed in the 72 hours either side of it, read on the console's server.

## Structure

- Gate first: the page asks for `releases` before it renders and before its address is read, so a person who does not hold it is answered by the refused page and nothing on the page is read. Its title comes from `gatedMetadata` and its loading state from `gatedLoading`, so under `refusal: 'absent'` neither names the release.
- The read comes before the masthead: a version the record does not hold is answered by the missing page, exactly as an address that names nothing is, so no masthead names a release nobody recorded.
- Masthead: the kicker back to Releases, `Release <version>`, and one sentence.
- Changelog, the page's protagonist: the section published for the release, as written, through the console's safe Markdown renderer (raw HTML in it is text, and a link or an image passes the console's URL policy). Its words show at once as plain text while the renderer arrives. Ask is in its head.
- This release: its summary, the console it shipped with (`Not recorded` when none is), the client action (`Nothing to do` only when it is positively known that none is needed; an old release with no notes reads `Unknown — no recorded upgrade notes`) and the releases inside either window.
- Upgrade notes: the published notes through the same renderer, or what the record says when there are none.
- Around the release: a table of the two windows, before and after: what of each was observed (`complete`, `partial` with its bounds and why, or `not observed`), its calls, malformed calls, malformed calls per 1,000, tool failures and p95. Its line says that a window is what was observed and not what the release did.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx` while the gate asks `/me` and the read is under way: the changelog's and the release's cards, the notes and the windows' table, as skeletons |
| Default | The changelog, the release, its notes and its windows |
| No such version | The missing page, from the server's read; from a later read in the browser, "No release of this version is recorded" with All releases |
| No upgrade notes | The client action recorded, or that nothing is asked of clients |
| A window still running or begun before the record | `partial` with the bounds the record observed and why |
| A window with no calls | `No calls`, with no rate and no p95 |
| Read failed | The error state with the gateway's sentence and Retry |
| Slower than 4.5 seconds | The same error state, saying the read did not answer within 4.5 seconds, with Retry |

## Agents

The assistant reads this page and changes nothing. The page shares its context through `releaseContext` in `src/views/platform-releases-context.ts`, the same function `view_release` calls on the same response, so the assistant quotes what the screen shows.

### What the agent reads

When the release's tag was made, the console it shipped with, its client action, each window's malformed calls per 1,000 with its calls, malformed calls, tool failures, p95 and what of it was observed, the releases within 72 hours of it, its summary, and its changelog and upgrade notes as published, cut to what holds the budget. It says that a window is what was observed and not what the release did, that a tag's time is historical timing, that under 30 calls a side is too few to compare, and that another release inside a window puts that release's calls in it too.

```text
- After: 3.3 malformed per 1,000 (610 calls, 2 malformed, 0 tool failures, p95 1,620 ms; Partial: observed 16 Oct 2026, 15:00 to 17 Oct 2026, 11:00 of 16 Oct 2026, 15:00 to 19 Oct 2026, 15:00, still running)
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address, and the page text after it for anything the context does not cover. `view_release` answers the same text from anywhere in the console, and `explore_release` (`src/views/releases-explore.ts`), offered on this page alone, asks what Releases' prepared query asks: the route has no dimension of a release's version, so nothing in it is held to this release.

### What the agent does here

Protagonist: Changelog.

- "How many releases were tagged in the last 30 days?" — the releases over 30 complete days, down to each release with its page
- "Which tools were refused as malformed most in the last 7 days?" — the malformed calls over 7 complete days, by tool
- "How many migrations were applied in the last 90 days, month by month?" — the migrations applied over 90 complete days, a month at a time

## Surfaces

Console, desktop and phone. Reads `GET /platform/releases/:version` on the console's server, as the person, once per request and bounded at 4.5 seconds; a Retry reads it again in the browser. It declares no live collection.
