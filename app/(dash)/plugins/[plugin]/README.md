# Plugin

One plugin: what it is, what it reaches, its skills, and its whole evaluation story.

## Structure

- Gate first: the page asks for `plugins` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read.
- Tiles: skills, gates, calls, never run.
- Overall fit for purpose: score, status, protocol, guardrails.
- About and the documents it governs.
- Health, usage, quality, learning, evolution, automation and trust.
- Its skills, stages first and in order.

## States

- Never profiled or never scored: one panel says the evaluation has not happened yet.
- A third-party subject: its evaluation with no manifest above it.
- Not a plugin: an empty state pointing back to the list.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `pluginContext` in `src/views/plugin-context.ts`, the same function `view_plugin` calls, so the assistant quotes the figures the screen shows. No Ask on this page: each evaluation card states its own finding.

### What the agent reads

The plugin's skills, gates, calls and refusals, and the skills never run. What code found: its declared version and whether a release vouched for it, the servers it reaches, its method's stages and front door, the documents it governs, then its evaluation: the score with the protocol and version measured, the score by dimension, the failing guardrails, the runs it was scored on, its findings and its candidates for change. It says when a plugin was never evaluated, or is registered for evaluation only.

```text
- Evaluated on 11 Oct 2026 against protocol sdlc-protocol v3, measuring version 0.92.10; guardrails pass.
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `query_plugins` looks up what the page lists.

## Surfaces

Console, desktop and phone. Reads `GET /plugins`, `GET /plugins/:plugin/eval`. Live: follows `plugins`, so a change made anywhere — another tab, another person — reads this page again.
