# Voice

How a Meridian dashboard speaks: in titles, labels, buttons, empty states, errors and the sentences it shares with a model. The interface talks like a precise colleague who respects the reader's time.

## The rules

1. **Say what it is, from the reader's side.** Name what people control and recognise: "API keys", "Requests", "Alerts", not "Credentials management" or "Event ingestion".
2. **Sentence case everywhere.** Titles, buttons, tabs, labels. Capitals are for names.
3. **Verb first on actions, and the same verb through the flow.** The button says "Revoke key", the dialog title says "Revoke this key?", the toast says "Key revoked".
4. **Numbers carry their unit and period.** "2.94M requests in the last 30 days." A figure without a period is a guess.
5. **Facts over adjectives.** "Errors rose from 0.6% to 2.1%", not "Errors spiked dramatically".
6. **One idea per line.** A head-note is one sentence. A hint is one sentence. If it needs two, the second is probably a link.
7. **The arrow says where a link goes.** → stays in the product ("All endpoints →"); ↗ leaves it, a new tab or the host's browser ("Open in ZZ Meridian ↗" from an embed).

## Patterns

| Moment | Write | Not |
|---|---|---|
| Page title | Overview · Requests · Health | Dashboard home · Request explorer |
| Head-note | Traffic, reliability and spend across every endpoint, for the period you choose. | Welcome to your dashboard! |
| Empty, first run | No API keys yet. Create one to start sending requests. | Nothing here. |
| Empty, filtered | No requests match "status: 5xx" in the last 7 days. Clear filters | No results found. |
| Error | Requests could not load. The data service did not answer in 10 seconds. Retry | Oops! Something went wrong. |
| Stale data | Stale · updated 47 min ago | Data may be out of date |
| Destructive confirm | Revoke key "Production backend"? Requests using it will fail with 401 at once. | Are you sure? |
| Agent proposal | Raise Parallax AI's rate limit from 1,000 to 2,000 requests a minute. | Claude wants to make a change |
| Agent provenance | Claude raised the rate limit for Parallax AI · for Jonas Weber | Rate limit updated (AI) |

## Errors

An error says what happened, why if known, and what to do, in the interface's voice. It does not apologise and does not blame. It never shows a stack trace to a person; it shows a reference id they can copy.

## Writing for the model

The context a view shares with both agents (`useShareView`, decision 0011) is not a caption. It is a complete statement of what the person sees: the view, the period with its dates, how fresh the data is, the figures with units, changes and definitions, the selected day or record, what code found and what the data cannot say. It is written so that a question asked next ("why?", "what about yesterday?") can be answered from it alone, and it is the whole state every time, never only what changed.
