# ZZ Stack on Meridian: the brief

The decisions behind the console's move to ZZ Meridian, so they outlive the conversation that made them.

## What it is and for whom

ZZ Stack is the browser console for the zz-stack platform. It carries the platform's name rather than one of its own, because it ships with the platform as one set. A superadmin reads the whole platform; a member reads
their own team. The home page answers one question: is the platform's work moving, and what is waiting on a
person?

## Route

Meridian came into the existing project (Meridian's route A): its tokens, components, shell and scripts were
copied in, and every page was rebuilt on them. The data layer did not move. Every read is still a browser
fetch to `/api/console/*` (`src/lib/api.ts`), every write goes through `src/lib/mutate.ts`, and the payload
shapes are still the gateway's (`src/lib/api-shapes.ts`). The routes are the same routes.

## Decisions

- **Dark first, light available.** Meridian's register. The person switches theme, accent and density in the
  rail's appearance menu or the command palette. The old console's single cream theme is retired.
- **Accent `zz`.** Derived from the ZZ brand purple `#7548d8` by `scripts/brand.ts --hex`: OKLCH hue 292,
  chroma 0.18. It is 70° or more from every status hue, so an accent fill never reads as a state. The contrast
  gate passes in both themes without lowering the fill.
- **The mark.** A capital and a small Z on the accent tile, drawn in SVG (`src/components/base/app-mark`),
  and the same paths for the tab icon (`app/icon.ts`). The PNG wordmark, the mascot and the illustrated empty
  states are gone: Meridian's empty states carry the message in words and one action.
- **Scope in the workspace menu.** A superadmin switches between the whole platform and their own team from
  the rail's workspace menu (and in Settings). The rail drops the platform-only pages in team mode
  (`src/nav.ts`).
- **The bell lists waiting gates.** Every gate document that is written and not approved, on an open
  initiative, with a link to the initiative.
- **No assistant.** Meridian's built-in assistant is not adopted: it needs collections the console does not
  have and a model key nobody asked for. The shell no longer mounts it, and `verify` has no assistant step.
- **The console's own rules, kept inside Meridian.** Tables read left in the first column, right in the last
  and centred between (`src/console/columns.ts`). A bar's length is its share of the total it is labelled
  against (`BarList total`). A tile or bar used as a mark has no legend row; hover names the part. Colour
  means something: a refusals list is not red on every row.

## How it is checked

`pnpm verify` runs the gate (tokens, specifications, contrast, types, tests), builds the app against a fake
gateway (`scripts/fake-gateway/`), serves it, audits every page at five widths in both themes, and presses
every control and follows every link. The fake gateway exists because the presses approve, revoke and archive
whatever a page offers, so they must never reach the real deployment. Its records are synthetic; nobody in
them is a real person.

What `verify` cannot say is how the pages look against production data. The fixtures cover the states a page
draws (empty, waiting, closed three ways, long names, a vendored plugin never run), and real data has more.
