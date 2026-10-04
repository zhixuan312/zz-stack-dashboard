# ZZ design principles

ZZ Console is built on two layers. **ZZ Meridian is the structure**: the grid, the components, the type scale, the
two themes, the motion, the accessibility floor. **ZZ is the brand on top of it**: who the product is, said through
its marks, its colour, its mascot and its voice. When the two disagree about structure, Meridian wins; when they
disagree about identity, ZZ wins.

The brand kit is in `design/reference/` (read it, never build from it) and the masters in `design/in-use/`.

## 1. Three marks, one per size, never redrawn

| Mark | Where | File |
|---|---|---|
| The flat **Z** with its sparkle | the browser tab, 16 to 32 px | `app/icon.png` |
| The **mascot squircle** | the home screen, 180 px and up | `app/apple-icon.png` |
| The **Zz wordmark** with its sparkle | inside the product, beside the name | `public/assets/brand/wordmark.png`, drawn by `AppMark` |

Each is cut from its own master by `scripts/build-brand-assets.py`. None is a scaled copy of another, and none is
redrawn in code: a hand-drawn approximation is a different logo.

## 2. One brand colour, and it means "this is ZZ, act here"

The accent is the brand's purple (`#7548d8`, OKLCH hue 292), registered as Meridian's `zz` preset so contrast holds
in both themes. It marks actions, selection, the current place, and the one featured figure on a page. It never
marks a status: health, warnings and failures keep Meridian's status hues, which sit 70° or more away from it.

The kit's lavender, pink and baby blue live in the artwork (the mascot, the stack symbol) and not in the interface.
A data view that turned pink and blue would be decorating, and its charts would lose the colour-vision checks
Meridian's palette passes.

## 3. The mascot appears where there is no data to lead with

The mascot is the product's face, so it shows up in the moments a person meets the product rather than its data:

| Moment | Pose |
|---|---|
| Signing in | the whole mascot, standing on the sign-in card |
| Enrolling a passkey | welcome |
| Nothing here yet (a first-run list) | empty |
| Nothing matches the filters, or no such page | not found |
| Something failed | error |
| Waiting for an answer from Ask | thinking |
| Signed out | goodbye |

Poses are chosen in one place, `src/console/brand.tsx`, and a state never borrows another's face. **The mascot
never sits beside data**: on a page with figures, the figures are the protagonist. An inline empty state (a row
inside a card) keeps Meridian's small disc, because the mascot at 36 px is a smudge.

## 4. Meridian's grounds and type, not the kit's

The kit's primary colour is a cream ground and its type feel is rounded. The console keeps Meridian's grounds (dark
first, a cool light theme) and Geist, deliberately: a console is read for hours, in both lights, and its numbers
must line up in tabular figures. The brand's warmth is carried by the mascot, the marks and the voice instead.

## 5. Voice: kind, plain and exact

The tagline is "AI friend for a brighter you", and it appears where a person meets the product: the sign-in screen
and the standalone footer. Everywhere else the voice is Meridian's: sentence case, verbs on buttons, a unit and a
period on every number, and a refusal said in the gateway's own words rather than softened. Kind means telling
someone what happened and what to do next, not cheering at them.
