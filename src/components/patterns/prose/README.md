# Prose

Prose renders markdown a person wrote (a document, an incident review, a note, an agent's reply) for reading, safely: raw HTML stays text, and a link or an image goes only where a reader would agree to go.

Status: beta

## Anatomy

1. **Measure**: running text holds to 72 characters; `text-base` at 1.7 (`sm`: `text-sm`, relaxed) in `ink-2`, `ink` for headings and bold.
2. **Headings**: the writer's `#` is an h2 (`text-xl`), `##` an h3 with a hairline above it, `###` an h4: the page keeps the only h1.
3. **Lists**: discs and numbers in `ink-3`; task boxes drawn as checkboxes named "Done" or "Not done".
4. **Code**: inline on `surface-sunk` with a `line` border; a fenced block on `surface-sunk`, `radius-lg`, wrapping instead of scrolling.
5. **Tables**: inside a `line`-bordered frame, a `surface-sunk` header row, `text-sm` cells. Every body cell carries its column's heading as `data-label`, in the server's HTML. With `stack`, a table under 480px of its own width reads as one card per row: the header row hidden, the first cell the title in `ink`, each later cell under its heading in `text-xs` `ink-3`.
6. **Quote**: a 2px `accent` rule on the left, `ink` text.
7. **Links**: `.link`, in `accent-ink`, turning `ink` on hover, never underlined; a link out of the product sends no referrer.

## Composition

`react-markdown` with `remark-gfm` (tables, task lists, strikethrough, autolinks) and no raw-HTML plugin; every element drawn on Meridian's roles. URLs pass `safeMarkdownUrl` (`src/lib/safe-markdown.ts`).

Prose has no state and no client code of its own, so where it is rendered decides what it costs. From a Server Component it costs the page no JavaScript at all: the markdown is parsed on the server and the reader is sent HTML. Imported into a client component, the renderer comes with it, 143 KiB in this build, and a reading page then waits for that chunk before its text can paint (an adopter's browser diagnostic reported it on four document pages: LCP 2.88 to 2.95 s against the 2.5 s floor, with 10 KiB of headroom under the first-load cap, so the route could not take it as first-load code either). A page whose view is a client component renders Prose in the server page and passes it down as `children`. The one place the template loads it in the browser is the assistant's panel, where the text arrives in the browser and the panel's code is fetched only when it is opened.

## Data

A markdown string. Line endings are normalised and the ends trimmed; nothing else is rewritten, so `` `<projectId>` `` in a code span reads as written.

## States

| State | What shows |
|---|---|
| A document | As above |
| Raw HTML in the text | Shown as text, never run or rendered |
| A link to `javascript:`, `data:` or another scheme a reader cannot follow | Its words, without a link |
| An image from another origin | Its alt text in italics (or "Image not shown"), never fetched |
| A long token in code or a link: a URL, a path, a hash | Breaks anywhere rather than widen its paragraph or table; plain words wrap between words |
| A table with more columns than the card holds | Scrolls inside its own frame; the page never scrolls sideways |
| `stack`, and a table under 480px of its own width | One card per row, each value under its column's heading; no header row |
| Empty | Nothing: the caller shows the empty state ("No notes yet") |

## Surfaces

- **Console**: in a card or a page at the reading width (832px), `base`.
- **Mobile**: one column; table cells wrap between words, code in them breaks anywhere, and a table still too wide scrolls in its frame.
- **Embed**: `sm`, in the host's font through the token bridge.

## Agents

An agent's reply in the assistant panel or an embed is written by a model, so it is content nobody vetted: render it with Prose, never as HTML. A link in it is a suggestion the person may follow; it never runs.

## Accessibility

- Headings start at h2 under the page's h1, so the outline stays in order.
- A task box is a disabled checkbox named "Done" or "Not done".
- Contrast: running text `ink-2` and links `accent-ink` hold 4.5:1 on `surface` in every theme and accent.

## Content

- Write for the measure: short paragraphs, a heading per question the reader has.
- Name links by where they go ("the runbook"), never "here".

## Do and do not

- Do render anything a person or a model wrote with Prose.
- Do not add `rehype-raw` or render markdown through `dangerouslySetInnerHTML`: `node scripts/check.ts` fails on the first, and the second throws the policy away.
- Do not import Prose into a client component for text the server already has: render it in the server page and pass it down as `children`, and it costs the page no code.
- Do not use Prose for the system's own specifications; the Atlas has its own reader, with anchored headings.

## Implementation

```tsx
import { Prose } from '@/components/patterns/prose';

<Card className="p-(--card-pad)"><Prose>{incident.review}</Prose></Card>
<Prose size="sm">{comment.body}</Prose>
<Prose stack>{decision.record}</Prose>   // tables become labelled cards in a narrow column
```

`stack` is for a document whose tables carry sentences (a decision record, a comparison) read in a narrow column. A table of short figures reads better scrolling in its frame, which is the default. Without `stack`, a page can still style its own narrow layout from `td[data-label]`.
