# Settings

A person's own tokens, client setup and teams, plus team and platform administration where their role carries it.

## Structure

Sections 56px apart, each with its title and purpose on the left and its cards on the right (one column on a phone),
at the data width like every other page.

- Gate first: the page asks for `settings` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read.
- Console scope: one setting row, the switch on the right; applies at once. The section is drawn for
  everyone and says which of the two scopes a superadmin has the choice of — only the switch is theirs, and
  its place is held either way, so nothing below moves when `/me` lands.
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

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `settingsContext` in `src/views/settings-context.ts`, the same function `view_settings` calls, so the assistant quotes the figures the screen shows. No Ask on this page. Its last section, Assistant, holds the person's own switch for the panel ("Show the assistant"), drawn only where the console has an assistant.

### What the agent reads

Who is signed in, their platform role, the team this browser acts for, the console's scope and how many live tokens they hold. What code found: which sections their role carries, their teams with their role in each, their live tokens by label and date, and the tokens never used. It says that every change here is made on this page by the person, and that a token's value is shown once and can never be read again, by anyone.

```text
- Their teams: atlas (admin, the one this browser acts for), beacon (member).
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `query_tokens` looks up what the page lists.

## Surfaces

Console, desktop and phone. Reads `/settings/me/*`, `/settings/team/*`, `/settings/platform/*`. Live: follows `settings`, so a change made anywhere — another tab, another person — reads this page again.
