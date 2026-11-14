# Page loading

Page loading is the frame and the shapes a route shows while its page streams in: a masthead skeleton, then a body in the shape of the page that is coming.

Status: beta

## Anatomy

1. **Frame** (`LoadingPage`): a page frame with a skeleton kicker, the page's own title when it is known (a skeleton when it depends on the record) and a skeleton description. For a page headed by a sentence (`sentence`), the heading holds the page's name, read out and not drawn, and the Shell's two bars in the block the sentence will take. A page that knows the rest of its masthead passes it too: its own kicker, the room of a long sentence under the title (`lead`) or of a shorter line that keeps a room of its own (`description`), its freshness (`meta`) and what stands where its actions will (`actions`), so the masthead is as tall here as on the page.
2. **Lead room** (`LeadRoom`): the room a long sentence under a page's title takes, kept whether the sentence fills it or not. Empty, it draws a bar a line; the page draws its sentence inside the same room, and gives its own fallback the empty one, so the three frames of a load are one height.
3. **Busy** (`Busy`): the body, announced once as busy under the page's name. A page whose masthead is already real uses it alone as its boundary's fallback.
4. **Shapes**: `FeaturedSkeleton` (the Featured metric, alone or, `beside`, as the opening row with three tiles in a column), `TilesSkeleton` (a row of tiles, three unless told), `ChartSkeleton` (a card with a chart-sized block), `LinesSkeleton` (a card of lines under a title, four unless told) and `TableSkeleton` (a card with an optional filter row and one line per row).

## Composition

Page frame, Card and Skeleton. It knows nothing of the product: each route composes the shapes in the order of its own page, so the routes still differ.

## Data

- `name` is the page's name, read aloud as "Loading customers".
- `title` is the page's heading, set the moment the state commits. Leave it out when the title depends on the record.
- `sentence` says the page is headed by a sentence that states its figures (the Shell, "The title"). `title` is then the page's name: it is kept in the heading for assistive technology and for whatever finds a page by its heading, it is what the top bar shows, and it is not drawn at the page-title size. The frame draws the sentence's placeholder in the block the sentence will take, so the heading is as tall here as on the page that replaces this state, and the body does not jump. It needs a `title`: with none there is no name to keep, and the frame is drawn as without it.
- `width` is the page's own width; a skeleton at another width moves the content when the page arrives.
- `description` stands where the page's line under the title will, for a line that is not a long sentence and keeps a room of its own: the page draws its line inside the room, and the loading state passes the same room with a bar in it (One customer's line of figures, `FactsRoom` in `src/views/customer.tsx`). It takes the place of `lead` and of the skeleton description.
- `kicker` and `meta` are the page's own, when they read no data: a skeleton kicker is a line shorter than the words, and a masthead with no freshness wraps its last row where the page's does not.
- `lead` keeps the room of a long sentence under the title: a line of the page's figures and who the page is for, up to about 220 characters. The room is three lines of the lead from 34em of the sentence's own column, four from 25em, five from 21em and six under that, in ems of the lead's 16px. The steps were worked out from Geist's advance widths, breaking lines as a browser does, for Home's longest sentence (an Owner's, 212 characters with who Main is for): three lines at 636px (the 60-character column) and 560px, four from 400px to 528px, five from 336px to 380px (358px on a 390px phone), six at 320px. A shorter sentence keeps the same room; a page whose sentence is longer needs steps of its own. The room is its own block formatting context (`flow-root`), so the margins of the bars it draws while empty stay inside it: a margin that passed through to the masthead's row would make the loading state taller than the page.
- `actions` stands where the page's controls will, as wide as they are, so the masthead's last row wraps where the page's does: on a phone the controls take a line of their own under the sentence, and a narrower placeholder would leave that line out. A page passes its controls themselves, out of sight and out of reach (`aria-hidden`, `inert`, `invisible`), as Home does in `src/views/period-actions.tsx`, and gives its own actions' fallback the same.
- `count`, `height`, `rows` and `filters` size the shapes to the page they stand in for.

## States

| State | Where it is composed |
|---|---|
| Route loading | each route's `loading.tsx`, in `LoadingPage` |
| Streaming body | a page's Suspense fallback, in `Busy` |
| Sentence on its way | a page's fallback for the sentence under its title, in an empty `LeadRoom`; the sentence arrives in a full one |

The whole route inside the shell is held still at [/system/states/loading](/system/states/loading).

## Surfaces

- **Console**: every dashboard route's `loading.tsx` and the Suspense fallbacks of the Home, Revenue, Now, Usage, Customers, Requests, Services, Tests and Releases pages.
- **Mobile**: the shapes stack as the page does. The lead room grows to six lines on a narrow phone, as the sentence does.
- **Embed**: not used; an embed view draws its own small state.

## Agents

An agent reads nothing from a loading state; it is announced to assistive technology only. A page that is loading offers no controls to act on.

## Accessibility

- One `role="status"` with `aria-busy` and the label "Loading customers" per page; the skeleton lines are hidden from assistive technology.
- The frame's title is the page's level-1 heading, so the page has its heading before its data. With `sentence` the heading reads the page's name alone ("Home:"): the bars that stand for the sentence are hidden from assistive technology.
- What stands where the actions will is out of the accessibility tree and out of the tab order (`aria-hidden`, `inert`, `invisible`): it is room, not a control. The real controls arrive in its place.

## Content

- The label is "Loading" and the page's name, lower case. No "please wait".

## Do and do not

- Do shape the skeleton like the page that replaces it.
- Do pass `sentence` when the page passes `PageFrame` a `name`: a name at the page-title size that a sentence then replaces moves everything under it.
- Do hold the whole masthead when the page's is more than a title: the kicker, the sentence's room, the freshness and the actions' width. One bar of description and no actions in place of three lines and a row of controls drops the body by the difference when the page arrives.
- Do not put a sentence in a `LeadRoom` it outgrows: the room is a floor, so a longer one grows it and moves the body.
- Do not draw a spinner for a whole page.
- Do not put a second busy status inside the first.

## Implementation

```tsx
import { LoadingPage, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';

export default function Loading() {
  return (
    <LoadingPage name="customers" title="Customers">
      <TilesSkeleton />
      <TableSkeleton />
    </LoadingPage>
  );
}
```

A page headed by a sentence, with the rest of its masthead held:

```tsx
<LoadingPage name="home" title="Home" sentence kicker={<>{app.name} · {app.workspace}</>} lead meta={<Freshness updatedAt={DEMO_UPDATED_AT} now={DEMO_NOW} />} actions={<PeriodActionsRoom />}>
  <HomeSkeleton />
</LoadingPage>
```

The page draws the sentence in the same room, and waits for it in an empty one:

```tsx
<PageFrame
  name="Home"
  description={<Suspense fallback={<LeadRoom />}><Lead /></Suspense>}
  actions={<Suspense fallback={<PeriodActionsRoom />}><Actions /></Suspense>}
  …
/>
// Lead returns <LeadRoom>{line} {audience}</LeadRoom>
```
