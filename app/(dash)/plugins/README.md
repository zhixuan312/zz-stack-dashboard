# Plugins

What a person installs: a package's skills and the servers they call, under one version, with its public score and your team's use of it.

## Structure

- Gate first: the page asks for `plugins` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read.
- Tiles: plugins, skills, required, skills your team never ran.
- A data table: plugin, required or optional, reaches, your team's calls, last run, score out of 10, standing, and the protocol and date it was scored; rows open the plugin.

## States

- Loading: skeleton rows.
- Empty: no plugin in the catalog.
- Never scored: the score reads `never scored`; a score not established shows its standing, never a number.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person, and nobody starts an evaluation from the console. The page shares its context through `pluginsContext` in `src/views/plugins-context.ts`, the same function `view_plugins` calls, so the assistant quotes the figures the screen shows. Ask is in the head of the Every plugin table: what the plugins in view are for, and which to install.

### What the agent reads

How many plugins the catalog holds and how many are required, their skills, how many have a public score, and the skills the team never ran. What code found: the plugin the team used most with its share of the team's calls; every plugin with whether it is required, its version, skills, the team's calls, its score with protocol and date, and whether its scores compare; and the commands that install the optional ones. It says a score belongs to its protocol version and to the version measured, that the calls are the team's alone, and that nobody starts an evaluation from the console.

```text
- sdlc is the one your team used most: 540 of its 555 calls (97%). Evidence: /plugins/sdlc
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `query_plugins` looks up what the page lists.

## Surfaces

Console, desktop and phone. Reads `GET /plugins`. Live: follows `plugins`, so a change made anywhere — another tab, another person — reads this page again.
