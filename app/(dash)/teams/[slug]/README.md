# Team, at today's address

Today's `/teams/<slug>`, which renders Platform's team page (`app/(dash)/platform/teams/[slug]`) until Phase 7 removes the address.

## Structure

- Gate first: the page asks for `teams` before it renders and before its address is read, then renders `/platform/teams/<slug>`'s page, which asks it again. Everything else is that page's, described in its specification.

## States

The Platform page's, in its specification. While the gate asks `/me`, the shell's own loading state, which names no page.

## Agents

The page shares its context through `teamContext` in `src/views/team-context.ts`, as `/platform/teams/<slug>` does; its context names `/platform/teams/<slug>` as its address.

### What the agent reads

What `/platform/teams/<slug>` shares. `view_team` and `explore_team` belong to `/platform/teams/[slug]`, so at this address the assistant offers no prepared query.

## Surfaces

Console, desktop and phone, as `/platform/teams/<slug>`.
