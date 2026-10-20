# Plugin

One plugin: how to install it, its public score with whether its scores compare, the owning team's evaluation where the gateway answers it, and every skill it ships with the team's own use of each, read on the console's server.

## Structure

- Gate first: the page asks for `plugins` before it renders, so a person who does not hold it is answered by the refused page and nothing on the page is read. Its title comes from `gatedMetadata` and its loading state from `gatedLoading`, so under `refusal: 'absent'` neither names the page.
- Its three reads, the catalog (`GET /plugins`), the owning team's evaluation (`GET /plugins/:plugin/eval`) and its scores' series out of the platform's Evaluation read (`GET /platform/evaluation`, only this plugin's handed on), are made together on the console's server before the masthead; the third never fails the page. A name the catalog does not list, with nothing registered for evaluation, is answered by the missing page, exactly as an address that names nothing is: the same body, and the same tab, `Not found`, never the name typed. The tab and the page are decided by the same three reads, made once a request.
- Masthead: the kicker `ZZ Stack · Work / Plugins`, the plugin's name and one static sentence.
- Its public score, the page's protagonist and its one featured card: the score a person acts on, out of 10 (or its standing, when nobody established it, or `Never scored`), headed by the protocol it was scored against (`v<n> of its own protocol` for a member, whom the gateway sends no key), with its standing, range and day, which of its earlier scores it compares with and which it does not, by score, day and protocol (`Comparable with its 6.4 of 6 Oct, the same protocol and population; not comparable with its 5.8 of 29 Sept, scored against sdlc-flow-quality v1`), read off the series the platform's Evaluation read groups its scores into, or the gateway's comparability statement as it is where that read did not answer, and the command that installs the plugin in a Copy field at its foot, cut at its front if it does not fit, so the plugin's name shows. The browser decides no comparability: the series are the gateway's. It says nobody starts an evaluation from the console. Ask is in its head.
- About this plugin, under it: required or optional (a neutral label, never the accent, which is kept for what a person presses), its version with the release's digest or `not released`, its owner, the servers it reaches, its method, and your team's calls of it, labelled `Your team`.
- Its evaluation, drawn only when the gateway answered it, which it does for the superadmin and the plugin's owning team alone, stepping back below the lead: overall fit for purpose at a card's size, saying it is the owning team's evaluation of the version it scored and whether it is the same scoring as the public score above or a different one (against another protocol version, it says the two do not compare); then health, usage, quality (each dimension's points of the overall, its weight shared out over the dimensions that count when one is not applicable or not scored, as the scorer does, with the sum written out, so the parts add up to the overall), learning, evolution (whose description says, once a release has a verdict, that a released change is judged on every team's runs of the released version, not one team's: the population its recorded reason speaks of), and who releases it with its judges, each judge in words (`Evidence judge, version 2`) with its key on hover. The overall reads to one place, as the public score does. Every word is a person's: a standing, a status, a guardrail, a dimension and an evaluator's qualification are put in words (`Qualified for use`, `Abandoned runs`), a measure's value in [0, 1] is a percent, a dimension's score is out of 10 like the overall, and a required dimension says `Required`. A finding's owner and a gated document are neutral labels. To anybody else the gateway withholds it, and that is its absence, not an error: no heading, no empty state and no sentence about who may read it.
- Its skills: a table, stages first and in order, with whose each is, its versions, and your team's calls and last run, labelled as your team's; a row opens the skill, and its name ends with an arrow that says so.
- The documents it governs, when it governs any, with which a person approves, headed `A person approves <n> of the <m>`.
- No control on the page starts an evaluation.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx` while the gate asks `/me` and the three reads answer |
| Default | The public score, About, the evaluation where answered, the skills and the documents |
| Never scored | The public score reads `Never scored` and the gateway's `No score to compare` |
| Evaluation withheld | Everything but the evaluation, and nothing in its place |
| Never profiled or never scored | The headline says the evaluation has not happened, and one panel says what each part waits for |
| A third-party subject | Its evaluation, with a line saying the catalog has no manifest of it, and no score, skills or install command |
| Not a plugin | The missing page, its tab `Not found` |
| Evaluation failed | Its own error state with the gateway's sentence and Retry; the rest stands |
| Catalog failed, or slower than 4.5 seconds | "The plugin did not load" with the gateway's sentence, or that it did not answer within 4.5 seconds, and Retry |
| Read again | Retry reads again in the browser, busy only after the person presses it and until that read answers; a read a change starts leaves the state and its Retry where they are, never busy, so a keyboard user keeps their place |
| Signed out since the gate | Sign-in |

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person, and nobody starts an evaluation from the console. The page shares its context through `pluginContext` in `src/views/plugin-context.ts`, and `view_plugin` builds the same context from the same two reads, withholding the evaluation exactly where the gateway does, so the assistant quotes the figures the screen shows. Ask is on its public score: how far that score can be trusted, whether to install the plugin and whether the version it declares is released, or, for a third-party subject with no manifest, on About this plugin: what its evaluation says.

### What the agent reads

The plugin's skills and gates, its public score with its protocol, date and what it compares with (the gateway's comparability statement where the series were not read), your team's calls and refusals, and the skills your team never ran. What code found: whether it is required and its install command, its declared version and whether a release vouched for it, the servers it reaches, its method's stages and front door, the documents it governs, then, where the gateway answered it, the evaluation, in the page's own scale and words: the score with the protocol and version measured, each dimension out of 10 as the Quality table prints it (`Completion 7.8`) with the Quality card's own sentence that rebuilds the overall from its parts, the guardrails as the percents Health prints, the runs it was scored on, its findings, its candidates for change with the reason recorded at release, and, for a release the verification judged, whose runs it was judged on, and its judges in words. It says when a plugin was never registered, profiled or scored, that the calls are your team's alone, and that nobody starts an evaluation from the console; of an evaluation withheld from the reader it says nothing. Its insights run install, the evaluation, its judges and who may release it, then what the catalog declares (version, method, documents), which its About card lists; over its budget it drops the last first.

```text
- Public score: 7.1 of 10 (established), protocol sdlc-flow-quality v2, 15 Oct 2026, between 6.5 and 7.7; Not comparable: a different protocol version. (Its latest score out of 10, and whether its scores compare, as the gateway states both.)
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address, and the page text after it for anything the context does not cover. `explore_plugin` (`src/views/plugins-explore.ts`), offered on this page alone, counts this plugin's skill calls, its findings and its established scores over any window, every call held to this plugin.

### What the agent does here

Protagonist: Its public score.

- "Which of its skills did we call most in the last 30 days?" — the calls of its skills over 30 complete days, by skill
- "How many findings were made about it, and what was decided?" — the findings over every complete day kept, by decision
- "Has its score been established in the last 90 days?" — the scores established over 90 complete days

## Surfaces

Console, desktop and phone; at 390px the public score leads with its install command whole as the card's width, About under it, and the skills are a card list of the skill, whose it is and your team's calls. Reads `GET /plugins`, `GET /plugins/:plugin/eval` and `GET /platform/evaluation` on the console's server, as the person, once per request and bounded at 4.5 seconds; a Retry and a change anywhere to the plugins collection are read in the browser. Live: follows `plugins`.
