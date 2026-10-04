# Settings

A person's own tokens, client setup and teams, plus team and platform administration where their role carries it.

## Structure

Sections 56px apart, each with its title and purpose on the left and its cards on the right (one column on a phone),
at the data width like every other page.

- Console scope (superadmin): one setting row, the switch on the right; applies at once.
- Your teams: the teams this person belongs to, and which one this browser acts for.
- Access tokens: the table, and issuing a new one on its last line (shown once).
- Client setup: the setup to copy, Copy on the code itself.
- Team administration (team admins): the team, its roster, and adding a member on the roster's last line.
- People (superadmins): every principal, and adding a person on the table's last line.
- Platform teams (superadmins): creating a team and archiving one, in one card.

## States

- Each list: loading rows, the gateway's sentence on error, and its own empty state.
- Destructive acts confirm in place, never in a modal.
- A new token is shown once, with Copy.

## Surfaces

Console, desktop and phone. Reads `/settings/me/*`, `/settings/team/*`, `/settings/platform/*`.
