# Settings

Settings' contents moved. Its address stays, gated as before, until Phase 7 removes it (AC-1.12), and draws one sentence saying so, with a link to Access, and nothing else.

## Structure

- Gate first: the page asks for `settings` before it renders, so a person who does not hold it is answered by the refused page and nothing is drawn. Its title comes from `gatedMetadata` and its loading state from `gatedLoading`.
- One sentence under the title, at the reading width: everything that was here is on Access now, with the link to `/access`. Nothing else: no section, no read, no control.
- Where each part went (reconciliation 53): the tokens, client setup, connected applications, signed-in browsers, passkeys, the team acted for with its switch, a team admin's members, the superadmin's console scope and the assistant's switch are on Access; People and Platform teams are Platform's People and Teams.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx`: the masthead and one line's placeholder |
| Default | The title and the one sentence with its link |
| Refused | The refused page, as an address that names nothing |

## Agents

The page reads nothing and shares nothing with the assistant, and has no view tool: `view_settings` went with its contents. What it held is shared on Access, through `accessContext` in `src/views/access-context.ts`, and the assistant's answers about tokens, applications, browsers, passkeys and teams are `view_access`'s and `explore_access`'s.

### What the agent reads

Nothing of the page's own: the page text, one sentence saying the contents moved to Access.

## Surfaces

Console, desktop and phone. Reads nothing.
