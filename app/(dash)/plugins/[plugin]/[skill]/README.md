# Skill

One skill a plugin ships: what it costs to run, its text, and what ships beside it.

## Structure

- Tabs (in the address): Cost to run, The skill, Reference.
- Tiles: runs, calls per run, median run, refused.
- About this skill: whose, position, produces, closed by, version, source.
- Cost: calls by door, busiest tools, and a two-line conclusion.

## States

- Never run: the cost tab says so and the text still reads.
- Not shipped by this plugin: an empty state pointing back to the plugin.

## Surfaces

Console, desktop and phone. Reads `GET /skills`, `GET /plugins`, `GET /skills/:name`, `GET /plugins/:plugin/skills/:skill`.
