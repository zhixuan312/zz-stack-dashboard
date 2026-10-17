# Teams, at today's address

Today's `/teams`, which renders Platform's Teams (`app/(dash)/platform/teams`) until Phase 7 removes the address. It leaves the rail in Phase 5.

## Structure

- Gate first: the page asks for `teams` before it renders, then renders `/platform/teams`'s page, which asks it again. Everything else is that page's, described in its specification.

## States

The Platform page's, in its specification. While the gate asks `/me`, the shell's own loading state, which names no page.

## Agents

The page shares its context through `teamsContext` in `src/views/teams-context.ts`, as `/platform/teams` does; its context names `/platform/teams` as its address.

### What the agent reads

What `/platform/teams` shares. `view_teams` and `explore_teams` belong to `/platform/teams`, so at this address the assistant offers no prepared query.

## Surfaces

Console, desktop and phone, as `/platform/teams`.
