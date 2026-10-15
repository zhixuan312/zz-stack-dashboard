# Skill

One skill a plugin ships: how your team's runs of it went, its text, and what ships beside it.

## Structure

- Gate first: the page asks for `plugins` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read.
- Tabs (in the address): Its runs, The skill, Reference.
- Tiles: runs, calls per run, median run, refused.
- About this skill: whose, position, produces, closed by, version, source.
- Its runs: calls by door, busiest tools, and a two-line conclusion.

## States

- Never run: the runs tab says so and the text still reads.
- Not shipped by this plugin: an empty state pointing back to the plugin.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `skillContext` in `src/views/skill-context.ts`, the same function `view_skill` calls, so the assistant quotes the figures the screen shows. Ask is on About this skill, the card every view of the page draws: what the skill is for and where it sits in its plugin's method.

### What the agent reads

Your team's runs of the skill, calls per run, median run, refusal rate and observed output per run (the response bytes of its calls, not what a model read and not a cost), each with what it is measured over. What code found: where it sits in its plugin's method and who wrote it, what it produces and what gate closes it, what it is for and when to use it, its calls by door, its busiest tools, and the size of its text with where to read it. It says that calls are attributed by the last skill served to the caller, and when a skill has never run.

```text
- Its calls by door: core 2,480 (73 refused), eval 216 (8 refused).
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `query_skills` looks up what the page lists.

## Surfaces

Console, desktop and phone. Reads `GET /skills?plugin`, `GET /plugins`, `GET /skills/:name`, `GET /plugins/:plugin/skills/:skill`. Live: follows `plugins and skills`, so a change made anywhere — another tab, another person — reads this page again.
