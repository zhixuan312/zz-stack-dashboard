# Plugins

What a person installs: a package's skills and the servers they call, under one version.

## Structure

- Tiles: plugins, skills, released, never run.
- A data table: plugin, reaches, calls, last run, evaluation score, status and when; rows open the plugin.

## States

- Loading: skeleton rows.
- Empty: no plugin in the catalog.

## Surfaces

Console, desktop and phone. Reads `GET /plugins`.
