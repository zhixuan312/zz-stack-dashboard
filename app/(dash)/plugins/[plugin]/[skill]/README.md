# Skill

One skill a plugin ships: how your team's runs of it went, its text, and what ships beside it, read on the console's server.

## Structure

- Gate first: the page asks for `plugins` before it renders, so a person who does not hold it is answered by the refused page and nothing on the page is read. Its title comes from `gatedMetadata` and its loading state from `gatedLoading`, so under `refusal: 'absent'` neither names the page.
- Its four reads, the catalog, your team's runs of the plugin's skills, the skill's calls by door and its text, are made together on the console's server before the masthead. A skill its plugin does not ship (its text answered 404) is answered by the missing page, exactly as an address that names nothing is.
- Masthead: the kicker `ZZ Stack · Work / Plugins / <plugin>`, the skill's name, one static sentence, and the tabs (in the address, read on the server): Its runs, The skill, and Reference when it ships one.
- Its runs: four tiles (runs, calls per run, median run, refused), all your team's, one of them lit as the page's lead: the refused share with `Above the 5% this page flags` where it passes that line, and otherwise the runs. Calls per run reads `67`, never `67.0`. The output's labels are `Output per run` and `Output in total`, short enough for the list's label column, and the caption under them says the output is observed; then calls by door, busiest tools and a two-line conclusion. The calls by door, the busiest tools, the refused share and the conclusion's reliability are one record, the platform's log of the tool calls filed under the skill (`logged` on `GET /skills`, the same population `GET /skills/:name` splits): the doors sum to the whole the card names, and so do the busiest tools with the tools past the eight the gateway sends, one row of their own. A run (`zz.skill_run`) counts only calls made inside an initiative's run, so the runs and calls per run say they are the runs'. Each tool's refused count is in its label, so a phone draws it too. With the log unread, the cards say so and the refused tile shows the runs' own share, said to be theirs.
- About this skill, on every tab, the page's protagonist: whose it is, its position in the method, what it produces, what gate closes it, its version and its source.
- The skill and Reference: its text, and each reference shipped beside it.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx` while the gate asks `/me` and the four reads answer |
| Never run | The tiles say so in words, the runs tab says your team recorded no call, and the text still reads |
| No reference | The Reference tab says none ships |
| Not shipped | The missing page |
| Runs record failed | Its own error state with Retry; About and the tiles stand |
| Text failed | The text's own error state with Retry |
| Read failed, or slower than 4.5 seconds | "This skill could not be read" with the gateway's sentence, or that it did not answer within 4.5 seconds, and Retry |
| Read again | Retry reads again in the browser, busy only after the person presses it and until that read answers; a read a change starts leaves the state and its Retry where they are, never busy, so a keyboard user keeps their place |
| Signed out since the gate | Sign-in |

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `skillContext` in `src/views/skill-context.ts`, and `view_skill` builds the same context from the same four reads, so the assistant quotes the figures the screen shows. Ask is on About this skill, the card every view of the page draws: what the skill is for and where it sits in its plugin's method.

### What the agent reads

Your team's runs of the skill, calls per run, median run, refusal rate and observed output per run (the response bytes of its calls, not what a model read and not anything paid for), each with what it is measured over. What code found: where it sits in its plugin's method and who wrote it, what it produces and what gate closes it, what it is for and when to use it, its calls by door, its busiest tools, and the size of its text with where to read it. It says that calls are attributed by the last skill served to the caller, that runs and calls are your team's alone, and when a skill has never run.

```text
- Its calls by door: core 2,480 (73 refused), eval 216 (8 refused).
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address, and the page text after it for anything the context does not cover. `explore_skill` (`src/views/plugins-explore.ts`), offered on this page alone, counts this skill's calls, runs and observed output over any window, every call held to this skill.

### What the agent does here

Protagonist: About this skill.

- "How many runs of this skill did we make each week this month?" — the runs over 30 complete days, a week at a time
- "How much output did its runs answer in the last 90 days, and for which initiatives?" — the observed output over 90 complete days, by initiative
- "How many calls of it did we make in the last 7 days?" — the calls of the skill over 7 complete days

## Surfaces

Console, desktop and phone. Reads `GET /plugins`, `GET /skills?plugin`, `GET /skills/:name` and `GET /plugins/:plugin/skills/:skill` on the console's server, as the person, once per request and bounded at 4.5 seconds; a tab is read there again as the navigation renders the page, and a Retry and a change anywhere to the plugins or skills collections are read in the browser. Live: follows `plugins` and `skills`.
