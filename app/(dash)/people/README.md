# People, at today's address

Today's `/people`, which renders Platform's People (`app/(dash)/platform/people`) until Phase 7 removes the address. It leaves the rail in Phase 5.

## Structure

- Gate first: the page asks for `people` before it renders, then renders `/platform/people`'s page, which asks it again. Everything else is that page's, described in its specification.

## States

The Platform page's, in its specification. While the gate asks `/me`, that page's loading state, which under `refusal: 'absent'` names no page.

## Agents

The page shares its context through `peopleContext` in `src/views/people-context.ts`, as `/platform/people` does; its context names `/platform/people` as its address.

### What the agent reads

What `/platform/people` shares. `view_people` and `explore_people` belong to `/platform/people`, so at this address the assistant offers no prepared query.

## Surfaces

Console, desktop and phone, as `/platform/people`.
