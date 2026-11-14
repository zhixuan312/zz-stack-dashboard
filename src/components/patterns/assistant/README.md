# Assistant

The assistant is a panel beside the page where a person asks about what they are looking at, opened from the top bar.

Status: beta

## Anatomy

1. **Launcher**: a round 36px button in the top-bar tools with the Agent mark, named "Assistant".
2. **Panel**: an `aside` named "Assistant", on the `frame` wash with a `line` edge, same as the rail.
3. **Head**: 56px; the Agent mark, "Assistant" (`t-card`), "Clear" and "Close" (small ghost buttons, an icon and the word; named "Clear conversation" and "Close assistant", which begin with the words shown).
4. **Thread**: the messages in order, scrolling inside the panel, kept at the newest. Each question carries a quiet "On <page>" caption above its bubble. A change the assistant wants to make is a Proposal card in the message. A failed turn shows a critical Banner with Retry under the thread.
5. **Composer**: a Textarea (grows to six rows) and Send (primary, icon only), on a `line` top edge.

## Composition

Agent mark, Icon button, Textarea, Button, Banner, Proposal, Prose. The conversation and the open state live in the shell, so the thread survives navigation.

## Variants

One. Width `assistant-width` (400px). Messages: a person's in a `fill-hover` bubble, `ink`, right-aligned; the assistant's is markdown read by `Prose` at `sm`, `ink-2`, under an "Assistant" caption (`t-caption`), in a block marked `data-assistant-text` — a reply may be a paragraph, a list, a table or a code block, so a check reads that handle rather than guessing which element the text landed in. The person's own message is plain text, as typed. All type is `t-small`.

## Sizes

Head 56px, composer padding 12px, thread padding 16px, message gap 16px. Launcher 36px; the `hit` class gives 44px to a coarse pointer.

## States

| State | Look |
|---|---|
| Closed | Nothing renders; the launcher is `aria-expanded="false"` |
| Open, empty | One sentence of help, `ink-3`, centred; under it, when the page in view shares questions (`SharedContext.questions`), one bordered `surface` button per question, full width, under "Questions to start with". Pressing one sends it as the person's own. A page that shares none keeps the sentence alone |
| Open, thread | Messages; the thread follows the newest |
| Thread, several pages | Each question is captioned with the page it was asked on ("On Members") |
| Error | A critical alert with what happened and Retry; the thread stays |
| Signed in as someone else | The thread is cleared and the alert says so: "You are signed in as someone else now, so the earlier conversation was cleared. Ask again.", with no Retry |
| Cleared | Back to the empty state, and a reply still arriving is stopped; Clear conversation is disabled while there is no thread |
| Waiting | Until the first words arrive, the thread ends with a Spinner and "Working on an answer" in `ink-3` (the Spinner is the status, so it is announced once); Send is disabled until the answer ends |
| Change waiting | A Proposal with Approve and Dismiss ("Approve and remove" for a removal) |
| Change applied, failed, dismissed or expired | The Proposal shows its state with no buttons; expired shows its reason |
| Send disabled | 45% opacity, while the text is empty |

The panel enters with no motion of its own yet; the launcher's states ease `color`, `background-color` and `border-color` with `--dur-hover`.

## Behaviour

- The launcher opens and closes the panel; Close assistant and Escape close it (not the Escape that cancels an input method's composition). The conversation is kept, and so is a message typed and not sent.
- Approve and Dismiss answer the waiting change; once the answer arrives the assistant continues on its own, and the page refreshes once after a change applies.
- Queries never draw a card; a mutation with no preview draws nothing.
- The thread lasts: it is kept in this browser's local storage under `<slug>.assistant`, the last 100 messages, until Clear conversation removes it. One thread serves the whole console and is sent nowhere but the assistant route.
- The thread is one person's, for the tenant they act for. `AssistantScope` (`scope.tsx`), around the shell in the dashboard layout, hands the panel that scope (`<tenant>/<subject>`); the thread is stored with it, and a change of either (another sign-in, View as, another tenant) starts an empty thread and removes the earlier one, on the first console page, before any panel opens. Each request names the scope; a route that now answers someone else refuses with 409, and the panel clears the thread and says why, with no Retry, then refreshes the route (`router.refresh()`): the layout resolves the scope of whoever is signed in now, and the next question is asked as them. The console records the scope it last loaded for (`loadThread` and `dropThread` write it beside the thread), and a tab writes only while that is its own scope (`saveThread`) and removes only a thread of its own scope (`forgetThread`), so a tab left open for the earlier person, whenever its reply lands, never replaces or deletes the thread the person now signed in stored from another tab; signing out removes it whoever's it is (`clearThread`). A shell rendered without `AssistantScope`, as a preview, keeps its thread under no scope.
- It loads after the page is on screen. A change that was waiting when the page closed or reloaded comes back expired: "The page was reloaded before anyone approved it." Sending a new message while one is waiting expires it: "You moved on before approving it." A change approved but reloaded before its result arrived comes back expired too, so it never runs again: "The page was reloaded before the change finished. Check the page to see whether it applied."
- If storage is full the newer half is kept; if storage is unavailable the thread lasts for the visit only.
- Each question is sent with the page it was asked on, and keeps that label when asked on another page later.
- Retry asks for the answer again.
- Enter sends; Shift+Enter adds a line.
- On send the browser reads the page: `path`, the page's title (the route's declared `document.title`, or the `h1` in the scroll region for a route that declares none) and the text of the scroll region, and sends them with the messages to `/api/assistant`. A node marked `data-assistant="omit"` is left out of that text (`pageText` in `page-text.ts`): it is taken out of the layout for the one read and put back as it was. A value shown once, such as a newly issued key's secret or a one-time link, is drawn so marked, or outside the scroll region (a `Dialog` portals to the document's body), so a question asked while it is on screen never sends it.
- When the assistant is off for the request, the shell renders no launcher and no panel, not even hidden markup: the launcher's place in the top bar is an empty, inert `data-assistant-slot`, and the panel's place is empty, because the column mounts only for an assistant that is on and has been opened.

## Surfaces

- **Console**: from 1024px a third column of the shell at `--assistant-width`; the page narrows by that much.
- **Mobile** (under 1024px): the same panel as a sheet fixed to the right edge over the page, at most the viewport less 48px; below `sm` (40rem) the whole width, since a strip of cut page words beside it reads as nothing.
- **Embed**: not applicable; the host is the assistant.

Both are decided by CSS breakpoints, never by measuring the window.

## Agents

This is the agent's seat in the product. It reads the page the person is on and answers; it changes nothing without a person: every mutation arrives as a Proposal in the thread. Its replies carry the Agent mark in the head and the "Assistant" caption. It reads none of what a page marks `data-assistant="omit"`, and none of another person's or tenant's thread.

## Accessibility

- The launcher is a button named "Assistant" with `aria-expanded`; the panel is a complementary landmark named "Assistant".
- The composer's textbox is named "Message"; Send and Close assistant are named buttons.
- Escape closes. Contrast follows Textarea, Button and the frame wash.

## Content

- Empty: "Ask about this page: what a figure means, or why it moved."
- Placeholder: "Ask about this page".
- Page label: "On <page title>", for example "On API keys".
- Clear: "Clear conversation". Error: what happened and what to do, in one line, with "Retry"; for example "The assistant could not reach its provider. Try again."

## Do and do not

- Do keep the panel quiet: one column of text.
- Do not render it, hidden or not, when the assistant is off.
- Do not measure the window to choose column or sheet.

## Implementation

```tsx
<AppShell rail={<Rail />} assistant={connection().then(() => assistantConfig(process.env) !== null)}>…</AppShell>
```

The layout does not await it: `connection()` makes the choice per request, and the shell resolves the promise with `use()` inside two small `<Suspense>` boundaries, one for the launcher's place and one for the column, so the request never blocks the frame and the page around them prerenders. Only the boolean reaches the browser.

**The launcher is its own module** (`launcher.tsx`), and the shell imports it and the panel as two dynamic chunks. That
is not tidiness: this file pulls in `useChat`, the AI SDK's client and zod schemas, `react-markdown`, `remark-gfm` and
`micromark` — 448 KB in one adopter's build (issue #7) — and the launcher is the only part of the assistant a page
draws while the panel is closed. The shell therefore mounts `AssistantColumn` the first time somebody opens the panel,
and keeps it mounted after that so the thread survives closing and reopening. `scripts/assistant.ts` measures the split:
it lists the page's scripts with the panel closed, opens it, and fails when opening it fetched nothing new.
