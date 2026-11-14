# Motion

Motion has three jobs and no others: data arriving, a control answering the pointer, and things floating above the page, with a duration for each job, three curves, three things that loop while they wait, and nothing at all
under reduced motion.

Status: beta

## Anatomy

| Job | What moves | Class | Duration · curve |
|---|---|---|---|
| Arrive | Rows rise 8px and fade in, in reading order | `arrive` (on a parent), `rise` | `dur-enter` 320ms · `ease-out`, `stagger` 45ms apart |
| Arrive | Bars grow from their baseline | `grow-x`, `grow-y` | `dur-grow` 820ms · `ease-out` |
| Arrive | A line draws; an area reveals left to right | `draw`, `reveal-x` | `dur-grow` · `ease-out` |
| Answer | A control gives 0.5px and 98.5% | `press` | `dur-press` 110ms · `ease-out` |
| Answer | Colour and outline change | transitions | `dur-hover` 160ms |
| Answer | An indicator slides (the rail marker, a segmented thumb) | transitions | `dur-enter` · `ease-spring` |
| Float | Menus and popovers drop 4px into place from 97% | `float-in` | `dur-enter` in, `dur-exit` out |
| Float | Dialogs rise 10px from 98% | `dialog-in` | `dur-enter` in, `dur-exit` out |
| Float | The drawer slides in from the left | `sheet-in` | `dur-enter` in, `dur-exit-sheet` out |

## Curves

| Token | Value | Use |
|---|---|---|
| `ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Everything that arrives: fast, then settles |
| `ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Moving from one place to another while visible |
| `ease-spring` | `cubic-bezier(0.34, 1.36, 0.5, 1)` | What should feel physical: the rail marker, a switch thumb |

## Behaviour

- An animation plays when its data lands, once. Nothing moves while it is being read.
- A page arrives with motion only on the first load of a visit. A page reached by a click in the app, or one the router kept and shows again, is already there: the shell marks its main area `data-still` when the path changes, every arrival inside takes no time and ends in its final state, and the mark lifts after `dur-grow` + `dur-enter` so a change made on the page afterwards (a new period) still animates. A change of query alone is not a navigation.
- Three things loop, and only three, each while something waits: a Spinner's ring, a Skeleton's shimmer, and a fresh Freshness dot's pulse.
- Every keyframe lives in `src/styles/motion.css`.

## States

Under `prefers-reduced-motion: reduce` every duration and delay collapses, and arrivals (`arrive`, `rise`, `grow-*`, `draw`, `reveal-x`) show their final state outright; all three loops stop.

## Surfaces

- **Console** and **Mobile**: as specified.
- **Embed**: arrivals play on the first render only, so a re-render in the thread never replays them.

## Agents

Not applicable.

## Accessibility

- Nothing flashes more than three times a second; nothing moves without a person's action or new data.

## Do and do not

- Do cut any motion that does not explain a change.
- Do not animate layout properties on the page; animate `transform`, `opacity`, `clip-path` and stroke offsets.

## Implementation

`src/styles/motion.css`; the duration and curve tokens in `tokens/core.tokens.json` (`duration-(--dur-enter)`, `ease-spring` as utilities).
