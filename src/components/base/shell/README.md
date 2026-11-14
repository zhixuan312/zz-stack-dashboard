# Shell

The shell is the layout contract every console page shares: a fixed frame where only one region scrolls, a rail, a top bar, a masthead that scrolls away, and rows of cards in four splits and a width per kind of page.

Status: beta

## Anatomy

1. **AppShell**: fixed to the viewport, so the document itself never scrolls. It holds the rail and the main column, and places the global tools.
2. **Rail**: on the left from 1024px, its own scroll; below 1024px, a drawer.
3. **PageFrame**: the one scroll region of a page, holding:
   - **Top bar**: 56px, sticky. The drawer trigger (under 1024px), the compact title (once the masthead leaves), and the global tools. Clear at rest; glass (`ground` at 72%, `backdrop-blur-xl`, a `line` hairline) once scrolled.
   - **Masthead**: the kicker, the page title (a name at `t-page`, or a sentence that states the page's figures: see "The title"), one sentence (`t-lead`), and the meta and actions. Under a name they share the title's row and are aligned to its last line; under a sentence the kicker and the heading take a row of the masthead's whole width, and the meta and actions stand beside the one sentence under it, at the row's end and on its last line. It scrolls away with the content. A record more than one level deep puts its trail in the kicker: `kicker={<Breadcrumb items={[{ label: 'Teams', href: '/teams' }, { label: 'Atlas', href: '/teams/atlas' }, { label: 'Q3 review' }]} />}`. Breadcrumb's links carry `hit`, as any link laid out as a box must, or they fail the 44px touch rule at 390px.
   - **Body**: a `Stack` of `Row`s.
4. **Stack**: rows one `stack-gap` apart (14–20px), arriving in reading order on the first load; on a client navigation the shell marks its main area still, so a page already there does not replay its arrival, and it does the same on a first load that kept the reader waiting longer than the arrival lasts (Motion).
5. **Row**: one card, or cards split `1/2`, `2/3` or `1/3`, or a row of tiles.
6. **Assistant** (`assistant` is a `Promise<boolean>` the request resolves, so the layout never waits for it: pass `connection().then(() => assistantConfig(process.env) !== null)` without awaiting it, and read it back with `useAssistantAvailable()`, which returns the same promise). While it is pending the top bar already holds the launcher's place, a `data-assistant-slot` of the launcher's size, `aria-hidden` and with nothing in it that takes focus; it stays that way, empty and inert, when the promise resolves `false`, so the row of tools never shifts. When it resolves `true` the launcher joins the global tools in that place; its panel is a third column at `assistant-width` from 1024px and a sheet over the page below it. Nothing of it renders while it is closed, or at all when `assistant` is false — and the panel is a separate chunk from the launcher, mounted the first time somebody opens it, so a page that never opens it does not download `useChat`, the AI SDK or the markdown renderer at all (issue #7). Once opened it stays mounted, so closing and reopening keeps the thread. The person's switch (Settings, "Show the assistant", stored as `assistant` in their preferences, on by default) hides the launcher and the panel without touching the conversation, which stays on the device. `useAssistantAvailable()` tells Settings whether the product has an assistant to switch.

## The four rules

1. **One scroller.** PageFrame is the only element on a page that scrolls, and only vertically. No card, table or list scrolls on its own.
2. **Cards are their content's height.** A list that can pass ten rows pages; a "top N" list stays at N.
3. **Four splits.** Full, `1/2`, `2/3`, `1/3`; and `tiles`, whose columns follow how many tiles it holds and its own width for two to four tiles (four are four or two, three are three or one, never a hole). One tile spans the row; five or more run in rows of two, then three, and the last tile spans whatever its row leaves empty. Cards in a row are the same height; every card is a direct child.
4. **Three widths, one per kind of page.** `data` fills the canvas at every size (`data-width` is 100%), so a wider screen shows more, not a centred strip: every analytical page uses it, and their titles sit on the same left edge. `form` is a form page's own measure (`form-width`: a 15rem head column, the column gap, a `field-width` card and the page's gutter). It fills the canvas until the canvas is wider than a form needs, then centres — the remainder splits evenly instead of leaving a strip at one side. Settings is the page that uses it. `reading` (`reading-width` 832px, centred) is for a page that is one long document, such as an article rendered with Prose. The top bar always takes the canvas width, so the tools never move; past a page's own width the light fills the margins.

## The title

A page's heading is one of two things, and the page says which.

- **A name.** `title="Members"` and no `name`: the heading is the name at the page-title size (`t-page`), and the top bar shows the same name once the heading has left. A list, a form and Settings are headed this way.
- **A sentence.** `name="Home"` beside `title="The highest 30 days yet: $3,300,438.74, the 3rd record in a row"`: a page that leads with figures is headed by what they say. The heading is still the page's one `h1`. It holds the name first, read out and not drawn, then a colon, then the sentence, so a screen reader hears "Home: The highest 30 days yet…", its list of headings still finds the page by its name, and so does anything that reads the heading for the name (the journeys and the navigation check look for it there). The top bar shows the name, never the sentence, and the document's title stays the name.

`speaksName` is for a sentence that opens with the page's name ("Home is quieter than last week"): the name is then not announced beside it. It is needed only when the sentence reads data, so it cannot be compared with the name until it has arrived.

The sentence is set in the section role (`t-section`, `text-xl` 24–32px), balanced. It is not set at the page-title size: some eighty characters at 36 to 56px run to four lines or more on a phone and stand over the page's one featured figure, which is the page's protagonist. At the section size the sentence is a headline of two lines on a desk and three on a phone, and the figure keeps the page.

| State | The heading |
|---|---|
| A sentence | The name, out of sight, then the sentence |
| On its way | The name, out of sight, then two bars in the sentence's block, hidden from assistive technology. `title` may be a part that reads data: the heading is in the first HTML and the sentence takes the bars' place when it arrives |
| Loading | A loading state that knows the page will be headed by a sentence passes `name` and no `title`, and draws the same bars. `LoadingPage` does it when given `sentence` (Page loading) |
| Came to nothing | `title` rendered nothing, because the page could not work its sentence out: the name heads the page at the page-title size, as on a page that passes no `name` |

**The sentence's block is held.** It keeps room for the lines a sentence of some eighty characters wraps to, and keeps it whether the sentence fills it or not, with the sentence on the block's last line. So the bars and the sentence are one block, nothing under the heading moves when one takes the other's place, and the body starts at the same height on every page headed by a sentence. The room follows the width of the heading in ems of the role, which is its width in characters; the heading carries the role's size so the steps can be read against it.

| Width of the heading | Lines held | Where |
|---|---|---|
| Under 14.5em | 4 | A phone narrower than 380px |
| From 14.5em | 3 | A 390px phone (14.9em); a 1280px desk with the assistant open (19.8em) |
| From 21.5em | 2 | A tablet (768px is 30em); a desk (1440px with the rail is 35em, and 22em with the assistant open) |
| From 42em | 1 | A wide desk (1920px is 49em) |

The steps come from the sample's own titles, measured in the product's font at the role's weight and tracking: every title of Home, Usage and Revenue stands in three lines from 14.5em and in two from 19.9em. A sentence longer than the room held for it takes another line and the block grows by it. Keep a title under ninety characters, and cut words before it wraps a fourth time: type is never shrunk to fit.

**The heading has a row to itself.** The room the block keeps is read from the heading's width, so that width must be the same while the page loads as when it has arrived. Beside the meta and the actions it was not: a loading state has none, and a period select arrives wider than the bar that stands for it, so the heading narrowed past a step when the page arrived, the block went from two lines of room to three, and everything under it dropped (34px at 1440px, 26px at 1024px, measured in a browser). So `PageFrame` lays a sentence's masthead out in two rows:

1. The kicker and the heading, the masthead's whole width. The heading's width follows the viewport, the rail and the assistant only.
2. The one sentence under the title (12px under the heading), which grows, with the meta and the actions after it, at the row's end and aligned to the sentence's last line; where the row is too narrow for both they wrap under the sentence, 20px below it. With no sentence the meta and the actions stand at the row's start, 20px under the heading, and nothing is left to grow in the sentence's place. With neither there is no second row.

A page headed by its name keeps the one row it always had: the kicker, the title and the sentence in a column that grows, the meta and the actions beside it.

`PageTitle` is the heading alone, for a preview or a frame of your own; `PageFrame` draws it. A frame of your own that places a sentence's heading gives it a width that does not depend on what loads later.

## Sizes

| Part | Value |
|---|---|
| Rail | `rail-width` 260px |
| Assistant | `assistant-width` 400px (from 1024px) |
| Data width | `data-width` 100%: the canvas, for every analytical page |
| Form width | `form-width` 1253px at the template's own root: a `field-width` card and its head column; a form page centres on it past that |
| Reading width | `reading-width` 832px: one long document |
| Stage width | `stage-width` 1560px: a standalone screen (sign in, not found) |
| Gutter | `gutter`: 16px on phones to 56px on wide screens (fluid) |
| Top bar | 56px |
| Masthead | 16px under the top bar (24px from 1024px), 32px (40px) under the title block |
| Title, a name | `t-page`, one line |
| Title, a sentence | `t-section`, in a block of four, three, two or one of its lines by the heading's width |
| Row gap | `stack-gap` 14–20px (12px compact) |

## Behaviour

- The compact title fades into the top bar (opacity and 4px rise over `dur-enter`) when the page title passes under it, measured with an IntersectionObserver. It is the page's name: the `name` of a page headed by a sentence, the title of any other.
- The drawer closes on navigation, Escape and the scrim, and returns focus to the trigger that opened it. It opens as a modal dialog (focus trapped, the page behind hidden from assistive technology) and moves focus into the sheet one frame after the open's commit, not inside the tap: focusing in the commit made the browser lay the whole page out there. Navigating also forgets the page it was opened on, so Back to that page leaves it closed: it opens only on a press.
- **Opening the drawer.** `NavTrigger` asks the shell through its context, and the shell counts the presses in its own state; the drawer opens whenever the count it has answered is behind. The drawer waits behind its own boundary (below), so on a phone the page and its trigger can be there before it: a press made then is answered once, when the drawer arrives, and a press after it closed opens it again. From 1024px there is no drawer to see, and a press changes nothing visible.
- The shell never reads the address itself. A route with a parameter the build did not know (a record's page) has no pathname until the request, and whatever asks for one waits for it; so each part that does ask — the drawer, the mark that holds a navigated page still, and the rail a product passes — waits behind its own boundary, and the frame and the page's own skeleton are prerendered for every route. `node scripts/route-policy.ts` fails a build in which a route's shell for an unknown parameter is an empty file.
- **Leaving with unsaved changes asks first.** A component that holds unsaved changes calls `useUnsavedChanges(dirty)`; `FormSection` does, with its `dirty`. While any does, the shell hears a plain click on a link anywhere on the page, in the rail a product passes and in the drawer (drawn in a portal, outside the shell's own element), before the link's own handler runs, because a router's link component navigates in its handler unless the click was already prevented. It stops the click and asks "Leave without saving?" with Stay and Leave. Stay closes the question and leaves the address, the form and what was typed as they were, and discards the held navigation. Leave goes through the router to the link's address as written, path, query and fragment. Saving or discarding stops the holding at once, and so does a form that leaves the page (a page the router keeps hidden holds nothing while hidden). One question is open at a time.

  Dirty means a local draft differs from its last confirmed record, not proof that a request wrote nothing. After a missing response the caller keeps its draft; the question does not claim noncommit or promise to undo an already-sent request.
- **What is held, and what is not.** Held: a plain click in this tab on a link to another page of this origin, and a navigation started from code through `useLeave()`, whose `leave(go)` runs `go` at once when nothing is unsaved and otherwise asks first. The Rail's menu, the command palette, a table row that opens an address and the product's workspace switcher all go through it. A product that navigates from its own code goes through `useLeave` too; a navigation it makes when an action has completed (deleting the record the form belonged to) does not need to. Not held: a click with a modifier key or another button, a link that opens another tab or frame or downloads, a link to another origin or to the page already in view, all left to the browser. Closing or reloading the tab gets the browser's own warning while something is unsaved, and none otherwise.
- **Back and Forward are the browser's and are not held.** The router gives a page no way to hold a history step, and a guard that pretends to, by pushing the address back, breaks the Back button. Outside a shell (a card's preview, an embed) both hooks are harmless: nothing is registered and `leave(go)` runs `go`. `AppShell` asks the router for `useRouter`, so a test that stands in for `next/navigation` needs it. The question itself (`leave-question.tsx`) is a chunk of its own, fetched when something on the page first becomes unsaved, so a page that never asks does not download a dialog: a test waits for it (`findByRole`), as a person does. The guard never reads the address, so the shell stays prerendered.
- Never set `transform`, `filter` or `will-change` on `html`, `body` or anything above AppShell: it would turn the fixed frame into one that scrolls.

## Surfaces

- **Console**: as specified.
- **Mobile**: under 1024px every split stacks to one column; the rail is a drawer; the masthead's actions wrap under the title, or under the one sentence when the title is a sentence. A title that is a sentence holds three lines at 390px and four on a narrower phone.
- **Embed**: not used. An MCP App view uses the Embed frame instead.

## Agents

Every console page keeps its state in its address (period, filters, the selected record), so an agent or a shared link opens exactly the same view. A title that is a sentence is worked out by code from the page's figures, and the page's shared context leads with the same sentence (`.agents/skills/zz-meridian/references/customize.md`, "A title that states the figures, and the facts beside it"): what a person reads at the head of the page is what an agent is told first.

## Accessibility

- `aside` named "Primary" for the rail; `main` for the content; one `h1` per page.
- A heading that is a sentence begins with the page's name, visually hidden and read out: "Home: The highest 30 days yet…". The bars that stand for a sentence on its way are hidden from assistive technology, so until it arrives the heading reads the name alone.
- The first Tab stop is "Skip to content", shown only while focused: it moves past the rail and the top bar to the masthead (`#content`), so the next Tab is the page's own first control.
- The compact title is `aria-hidden`: the page title is the heading.

## Content

- A title that is a sentence states a figure the product records, with its unit and its period, and what is wrong today in the same sentence where its rule has a clause for it. It has no full stop, as a name has none, and no word of praise: the figure is what is said (`.agents/skills/zz-meridian/references/customize.md`, "A title that states the figures, and the facts beside it").
- A page works its title out with a function that has a branch for each thing it may say, with a test for each branch, and never writes the sentence by hand.

## Do and do not

- Do build every page from PageFrame, Stack and Row; a page has no layout of its own.
- Do put `*:min-w-0` on any grid you write yourself, and start it from one column. A grid item's default is `min-width: auto`, so a child that truncates never gets a width to truncate at: the column grows to its longest word and the page scrolls sideways — on a 390px phone, while `Row` beside it looks right. `Row` carries `*:min-w-0` for exactly this.
- Do not nest a scroller in a card; page the list instead.

## Implementation

```tsx
import { PageFrame, Row, Stack } from '@/components/base/shell';

<PageFrame kicker="ZZ Meridian · Production" name="Home" title={<Title … />} description="…" meta={<Freshness … />} actions={<PeriodSelect … />}>
  <Stack>
    <Row split="2/3"><FeaturedMetric … /><div>…tiles…</div></Row>
    <Row split="1/2"><Card … /><Card … /></Row>
  </Stack>
</PageFrame>
```

`Title` is the page's own part: an async component that reads what the page reads and returns the sentence, or nothing when it could not be worked out. A page whose data is already in hand passes the sentence as a string.

`src/components/base/shell/index.tsx` exports `AppShell`, `NavTrigger`, `PageFrame`, `PageTitle`, `Stack`, `Row`, `WIDTH`, `useAssistantAvailable`, `useUnsavedChanges` and `useLeave`.

```tsx
const leave = useLeave();
<Button onClick={() => leave(() => router.push('/services'))}>Open Services</Button>
```
