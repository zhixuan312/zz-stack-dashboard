# Rail

The rail is the console's navigation: every destination in the product, grouped, with the current page marked by an accent-tinted pill that springs to the item you choose.

Status: beta

## Anatomy

1. **Brand**: the App mark at 28px, the product name (`text-md`, 600) and the workspace as an eyebrow; the whole row opens the account menu: Workspace settings, Sign out, and — where the product may be read as someone else — the View as group. A product with several workspaces or scopes (one team, the whole platform) passes them as `scopes` (`{ id, label, active, onSelect, href }`, `href` where choosing it goes); the menu then lists them as radio items under "Show", the row's glyph is the switcher's `ChevronsUpDown`, and `workspace` sets the eyebrow to the one in view. With one scope or none there is nothing to switch between, so there is no `Show` group and no checked row of its own: the row is the account menu, its glyph is a plain `ChevronDown`, and its label says so.
2. **Groups**: an optional eyebrow (`t-eyebrow`, `ink-3`) over a list of items; groups sit `space-6` 24px apart.
3. **Item**: a 16px icon at a 1.75 stroke, the label, and an optional count badge.
4. **Branch**: an item that other items name with `under` is a parent. Its row holds two controls: the item's link, to the parent's own page, and a button at the row's right end named `<label> pages`, whose one `ChevronRight` turns a quarter to point down while the branch is open. Its sub pages are a nested list under the row, on a 1px `line` guide line hung under the parent's icon; a sub page has no icon and its label lines up with the parent's label. A navigation has three levels at most: group, item, sub page.
5. **Marker**: one pill behind the current item, `accent-tint` with an inset `accent-line` ring and a 2px `accent` edge on the left that carries a soft glow.
6. **Account**: the person's avatar, name and role, and the Appearance menu, in a hairline card at the foot.

## Composition

App mark, Avatar and Appearance menu, on `frame` (a translucent wash with `backdrop-blur-xl`) and a `line` hairline on its right edge. The navigation is the `nav` prop, and the rail holds no route knowledge of its own. In the console it arrives through `ConsoleRail`: the `nav` from `src/app.config.ts`, or the product's own when it passes `nav` there, narrowed to what the person may open. A product whose destinations depend on the person (admin or member, platform or team) passes the groups that person may see. Pass the same groups to the Command palette.

**`nav` cannot be built in a server component.** Each entry carries its Lucide icon as a component, and a function cannot cross from a server component to a client one — React refuses at runtime with "Functions cannot be passed directly to Client Components", so every page answers 500 while types, lint and tests stay green. Build the groups in a client module (`src/views/console-chrome.tsx` is the template's: `'use client'`, importing `nav`) and render that from the layout, passing it what depends on the request as a promise it does not await: `access` (`chromeAccess()` in the template), which resolves to the hrefs this person may see, their name and role, and the personas the console may be read as — plus `signOut` (`signOut={null}` where there is no sign-in). The audit catches it: served app, every page measured, so a 500 fails there.

## Sizes

| Part | Value |
|---|---|
| Width | `rail-width` 260px |
| Brand row | 64px tall, `space-4` 16px side padding |
| Item | 36px tall, `radius-md` 10px, 12px side padding, icon to label `space-3` 12px |
| List padding | `space-3` 12px sides, items 2px apart |
| Count badge | 20px, `radius-full`, `warning-tint` and `warning-ink`, `text-2xs` 600 |
| Account card | `radius-lg` 16px, `line` border, `surface` at 50%, 10px padding, `space-3` 12px margin |

## States

| State | Item | Icon |
|---|---|---|
| Rest | label `ink-2` | `ink-3` |
| Hover | `fill-hover` behind, label `ink` | `ink-2` |
| Current | the marker behind, label `ink` 500 | `accent-ink` |
| Focus (keyboard) | 2px `accent` outline | as rest |
| Branch open, a sub page current | the sub page takes the marker, and the guide line beside it lights in `accent`; the parent's label is `ink` and its icon `accent-ink`, with no pill | |
| Branch closed, a sub page current | the parent's link takes the marker, with `aria-current="true"` | `accent-ink` |
| Parent's own page current | the parent's link takes the marker, whether the branch is open or closed | `accent-ink` |
| Sub pages the person may not open | the parent is a plain item, with no button | |
| Parent the person may not open | the sub page is a plain item in the group, with its own icon | |

The preview's specimens are the real Rail, so rest and current are drawn in them, and hover and focus are seen by using them: point at an item, or tab to it.

Colours change over `dur-hover` 160ms. The marker moves (`transform`, `height`) over `dur-enter` 320ms on `ease-spring`, so it lands with a small settle. Under reduced motion it jumps. The marker reads the current item from the list's own observation, `observe`'s first delivery included — the rail takes no offset itself, because a rail mounting inside a tap (the phone drawer opening) would make the browser lay the page out inside that tap: measured at a 50 ms frame against 33 ms for the mount alone, on the two heaviest pages. Until an observation has arrived the current item draws the same pill itself, so nothing moves when the marker takes over, and the marker brings the lit edge a frame later.

## Behaviour

- An item is a link: Enter or a click navigates; the marker follows the new page. An item with `prefetch` has its page prefetched in full, URL data included, when the link is shown, so the press finds the page ready.
- While a destination's page is on the way (a page that renders on request and is not prefetched), its icon turns into a 14px Spinner in the same 16px slot (`useLinkStatus`), named "Opening Members", so the click is answered at once and nothing shifts. A prefetched page is never pending, so it never shows.
- An item is current when the path equals its route or sits beneath it (`/requests/req_…` keeps Requests current); Home (`/`) only matches itself. The current page is the longest such route among every destination the product declares (`declared`, which `ConsoleRail` passes from the whole navigation), and it is lit only when this person's rail holds it: an address under a destination they may not open (`/admin/audit` for someone who holds `/admin` only) lights nothing, never the shorter one above it.
- Navigation from the account menu (Workspace settings and Sign out) asks first while a form on the page has unsaved changes, through the shell's `useLeave`; a link is held by the shell itself. Outside a shell it goes at once. Opening the menu prefetches each other scope's `href`: a row is a press, so nothing fetches its page before, and a phone's closed drawer prefetches nothing. A workspace chosen from the switcher runs the `onSelect` the product passed, so the product's own handler asks (the sample's does, in `src/views/workspace-chrome.tsx`); choosing a person under View as is not a navigation and is not held.
- A parent's button opens and closes its branch: Enter or Space, or a click. A closed branch mounts none of its links, so nothing in it is prefetched, tabbed to or read by a suite. The marker is measured again whenever a branch opens or closes.
- The button's chevron is one icon that turns a quarter by the hover duration (right when closed, down when open) rather than swapping, and reduced motion stills it through the system-wide reset. Focus stays on the button after a toggle, because a toggle never remounts it.
- Beside a current sub page the marker draws no lit edge of its own: the guide line's lit stretch is the only accent line there. Over a second-level item, including the parent of a closed branch, the marker keeps its lit edge.
- A branch is open on arrival when the current page is its parent's page or one of its sub pages, and closed otherwise. A change of the current navigation item to a parent or one of its sub pages opens that branch again, even one the person closed. Following the already-current item or another address under that same item does not reopen it. Otherwise a person's open or close stands for as long as the rail stays mounted, which spans every navigation inside the console: a branch they opened stays open elsewhere. The state is not stored, so a reload starts from the arrival rule. The phone drawer mounts its rail each time it opens, so it applies the arrival rule afresh.
- Only one element in the rail carries `aria-current` at a time: `page` on the current link, or `true` on the parent of a closed branch that holds the current page.
- `nav` is what this person may open. A sub page whose parent is not in `nav` is drawn as a plain item in its group, with its icon; a parent with none of its sub pages in `nav` is a plain item. `declared` still lists every href, so an address under a destination the person may not open lights nothing.
- `current` overrides the pathname (previews and tests); products leave it unset.
- View as: the personas are radio items, so the arrows move through them and Enter switches. The one in view carries the check; a persona who is not Active is listed but disabled. A `choose` that rejects shows its message in a critical toast and changes nothing — the check stays on the person who is still signed in.

## Surfaces

- **Console**: fixed at the left edge, its own scroll when the list outgrows the window.
- **Mobile**: under 1024px the same node opens as a drawer from the top bar's menu button: 260px (at most 86% of the screen), over a blurred scrim; it closes on Escape, on the scrim and on navigation, and returns focus to the trigger. On a touch screen (`pointer: coarse`) every parent, sub page and button row is 44px tall and the button's target is 44 by 44; on a fine pointer a sub page row is 32px and the button 28px.
- **Embed**: absent. A view in a host has one job and no navigation; it links out with Open in ZZ Meridian.

## Agents

Not applicable: navigation is how a person moves. An agent opens a view by its address, not by the rail.

## Accessibility

- `nav` with the name "Main"; the current item carries `aria-current="page"`.
- A parent's button has the accessible name `<label> pages` ("Usage pages") and `aria-expanded` set to `true` or `false`. While open, `aria-controls` names the branch's mounted list; while closed, it is omitted because that list is unmounted. It is a separate control from the parent's link, so the parent's page stays reachable from the rail. The parent of a closed branch that holds the current page carries `aria-current="true"`.
- Contrast (dark, indigo): inactive label `ink-2` on the rail 8.7:1, group label `ink-3` 7.0:1, current label on the marker 9.2:1; light 6.6, 4.9 and 5.7:1.
- The count badge repeats a number the page states in words; it is never the only signal. Its own name says what it counts — "API keys: 3 new" — so a clipped or isolated count still reads.

## Content

- Labels are nouns for places, one or two words, sentence case: "Home", "API keys", "Design system".
- A group's name, where a navigation names its groups, is a short noun for what a person does there: "Operate", "Billing". The sample names none: each of its groups is one workspace's entries.
- A persona is the person's name as the roster spells it ("Lucas Meyer"), never an id or an address; "View as" stays sentence case, like every other menu label here.

## Do and do not

- Do keep the rail to about ten items; a product with more needs sub pages under an item (`under`), or a second level on its pages (Tabs), not a longer rail.
- Do use `under` for sub pages that are destinations of their own, each with its own page and access. Use Tabs in the page for the views of one record, under one header.
- Do not put actions in the rail; it holds places only.
- Do not use the count badge for anything but something that needs attention now.
- Do not leave a badge to the number alone: it names its destination and count ("Services: 1 new"), which is its accessible name and its title.

## Session

- `user` is the signed-in person (`{ name, role }`); pass your session's. `null` while the session is still being found out draws a skeleton in its place, never a name that is not theirs. It defaults to the sample user in `app.config`. The console's own `ConsoleRail` takes the promise instead and passes this for you.
- `signOut` is a route (`'/sign-in'`, the default), a function (your auth's sign-out; from a server layout, wrap the rail in a small client component to pass one), or `null` to hide it. Sign out first removes the assistant's conversation from the browser (`clearThread`), so the next person to sign in there neither sees it nor sends it.
- `viewAs` is the personas the console may be read as: `{ current, options: { id, label, disabled? }[], choose }`. The menu lists them as radio items under "View as", with `current` checked. A product with one session leaves it unset and the menu has no such group. The options mount with the menu, so no persona's name is in a page's first HTML.
- The account menu shows Workspace settings only when the navigation has `/settings`; with more than one scope it is the workspace menu, and it is named that way for anyone reading the row with a screen reader.

## Implementation

```tsx
import { nav } from '@/app.config';
import { Rail } from '@/components/patterns/rail';

<AppShell rail={<Rail nav={nav} />} tools={<ShellTools now={updatedAt} />} assistant={assistant}>{children}</AppShell>
// The console mounts `ConsoleRail` (src/views/console-chrome.tsx), which filters `nav` by the signed-in person's access.
```

Edit `nav` in `src/app.config.ts` to change the destinations: `{ label?, items: [{ href, label, icon, needs, badge?, workspace?, feature?, prefetch?, under? }] }`; set `prefetch: true` on an item whose page is its URL data (a document under a dynamic segment), for one or two items at most.

`under` makes an item a sub page: it is the `href` of an item of the same group, and the rail draws the item in that item's branch.

```ts
{ label: 'Traffic', items: [
  { href: '/usage', label: 'Usage', icon: BarChart3, needs: FEATURES.usage.needs },
  { href: '/requests', label: 'Requests', icon: Activity, needs: FEATURES.requests.needs, under: '/usage' },
] }
```

`node scripts/check.ts` refuses a navigation it cannot draw, naming the item's `href`: an `under` that names no item of the same group, an `under` that names the item itself, an `under` that names an item that is itself under another (three levels, never four), a sub page whose `workspace` differs from its parent's (a declared workspace and an undeclared one differ), and more than 7 sub pages under one parent.
