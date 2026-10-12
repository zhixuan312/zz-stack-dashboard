# Plugins

What a person installs: a package's skills and the servers they call, under one version.

## Structure

- Tiles: plugins, skills, released, never run.
- A data table: plugin, reaches, calls, last run, evaluation score, status and when; rows open the plugin.

## States

- Loading: skeleton rows.
- Empty: no plugin in the catalog.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `pluginsContext` in `src/views/plugins-context.ts`, the same function `view_plugins` calls, so the assistant quotes the figures the screen shows. No Ask on this page: the table is the comparison.

### What the agent reads

How many plugins the catalog holds, their skills, how many are released of those declaring a version, and the skills never run. What code found: the most used plugin with its share of calls, the evaluations with a failing guardrail or an open defect, and every plugin with its version, skills, calls and evaluation score. It says a score belongs to the version that was measured, which may not be the one on the shelf.

```text
- sdlc is the most used: 11,305 of the 15,071 calls (75%). Evidence: /plugins/sdlc
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `query_plugins` looks up what the page lists.

## Surfaces

Console, desktop and phone. Reads `GET /plugins`. Live: follows `plugins`, so a change made anywhere — another tab, another person — reads this page again.
