# Plugins

What a person installs: each plugin's skills and the servers they call, under one version, with its latest public score and the command that installs it, read on the console's server.

## Structure

- Gate first: the page asks for `plugins` before it renders, so a person who does not hold it is answered by the refused page and nothing on the page is read. Its title comes from `gatedMetadata` and its loading state from `gatedLoading`, so under `refusal: 'absent'` neither names the page.
- Masthead: the kicker `ZZ Stack · Work`, the title and one static sentence, drawn before the read answers. The catalog carries no cutoff of its own, so there is no as-of line.
- The release's Records template, with no tiles: the spec's Plugins row names none.
- The table, the page's protagonist (`Every plugin`): plugin (its name and its own description), required or optional, version (with whether a release vouched for it), skills, gates, the score out of 10 with the protocol and the date it was scored against, and the command that installs it in a Copy field. The gateway's order, the team's most recently used first; a row opens the plugin.
- Filter bar: a search on the plugin's name, kept in the address as `?plugin=`, which narrows the rows the catalog read holds; the count of what it lets through, and Ask.
- A score nobody established shows its standing, never a number; a plugin nothing scored reads `Never scored`. The table holds nothing of the team's: the catalog and the scores are the platform's, the same for everybody, and the team's own use is on each plugin's page, labelled as the team's.
- Nothing on the page starts an evaluation: there is no such control, and the assistant says so.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx` while the gate asks `/me`, then the masthead over the table's skeleton with its filter bar while the read is under way |
| Default | The table of every plugin |
| Searched | The rows whose name holds the search, the count of them, and Clear |
| Searched to nothing | "No plugins match these filters" with Clear filters |
| Empty | "No plugin in the catalog" |
| Never scored, or not established | `Never scored`, or `Not established` with its protocol and date, never a number |
| Read failed | The table's error state with the gateway's sentence and Retry, which reads again in the browser |
| Slower than 4.5 seconds | The same, saying the read did not answer within 4.5 seconds; never an endless skeleton |
| In no team | The gateway's sentence that Work is the active team's, as the error state |
| Signed out since the gate | Sign-in |

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person, and nobody starts an evaluation from the console. The page shares its context through `pluginsContext` in `src/views/plugins-context.ts`, and `view_plugins` builds the same context from the same `GET /plugins`, narrowed by its one argument, `plugin`, as the page's search narrows it, so the assistant quotes the rows the screen shows. Ask is in the filter bar: what each plugin in view is for, how far its score can be trusted, and which to install.

### What the agent reads

How many plugins are in view and how many are required, their skills and gates, how many have a public score, and the skills the team never ran. Then each plugin in view, in the table's order, with whether it is required, its version and whether it is released, its skills and gates, its score with the protocol and date and the comparability statement as the gateway answered it, and its install command; then the team's own calls of them, labelled as the team's. It says that a score belongs to its protocol version and to the version measured, that whether scores compare is the gateway's statement, that the calls are the team's alone, and that nobody starts an evaluation from the console. Over its budget, the skills never run are dropped first, then the team's calls, then the last rows.

```text
- sdlc: optional, v0.92.10 released, 10 skills, 3 gates; score 7.1 of 10 (established), protocol sdlc-flow-quality v2, 15 Oct 2026; Not comparable: a different protocol version; claude plugin install sdlc@zz-stack.
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and search, and the page text after it for anything the context does not cover. `view_plugins` answers the same text from anywhere in the console, and `explore_plugins` (`src/views/plugins-explore.ts`), offered on this page alone, counts the team's calls of each shipped skill over `/work/query` over any window, by plugin or by skill; it lists none.

### What the agent does here

Protagonist: Every plugin.

- "Which plugin did we call most in the last 30 days?" — the calls of a shipped skill over 30 complete days, by plugin
- "Which skills did we call most this quarter?" — the calls of a shipped skill over 90 complete days, by skill
- "How did our calls of plugins move week by week this month?" — the calls of a shipped skill over 30 complete days, a week at a time
- "Which of sdlc's skills did we call in the last 7 days?" — the calls of a shipped skill over 7 complete days held to the plugin sdlc, by skill

## Surfaces

Console, desktop and phone; at 390px the table is a card list of the plugin, required or optional, its score and its install command with Copy. Reads `GET /plugins` on the console's server, as the person, once per request and bounded at 4.5 seconds; the search narrows that read where it is drawn, and a Retry and a change anywhere to the plugins collection are read in the browser. Live: follows `plugins`.
