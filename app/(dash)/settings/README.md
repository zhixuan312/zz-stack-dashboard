# Settings

A person's own tokens, client setup and teams, plus team and platform administration where their role carries it.

## Structure

- Console scope (superadmin).
- Access tokens and issuing a new one (shown once).
- Client setup to copy.
- Teams: which one this browser acts for.
- Team administration (team admins).
- Platform administration: people and teams (superadmins).

## States

- Each list: loading rows, the gateway's sentence on error, and its own empty state.
- Destructive acts confirm in place, never in a modal.
- A new token is shown once, with Copy.

## Surfaces

Console, desktop and phone. Reads `/settings/me/*`, `/settings/team/*`, `/settings/platform/*`.
