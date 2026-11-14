# Ask about

Ask about hands a card to the agent: one press posts a question about exactly what the card shows into the conversation, as the person.

Status: beta

## Anatomy

1. **Button**: 28px, a sparkles icon and the word Ask, `accent-ink` on transparent, `radius-md`.
2. **Tooltip**: "Ask the assistant about this".

## Composition

Placed in a card's header actions; on a settings page, in the first FormSection's actions, beside its title. It reads `useSurface().ask`; when that is absent it renders nothing.

## Data

`question` is the text posted, written for a person to read in the thread, naming the card's facts: "Why did requests fall on 27 September?" When the Meridian points at a day, the question names that day.

## States

| State | What changes |
|---|---|
| Rest | `accent-ink` text and icon |
| Hover | `accent-tint` behind |
| Pressed | `press` |
| Focus | 2px `accent` outline |
| Console with the assistant on | Rendered after hydration; a press opens the assistant panel and posts the question as the person's, with the page's view context |
| Console without an assistant, or no agent connected | Not rendered: no dead control |

## Behaviour

- One press sends `ui/message` with the question as the person's message; the host's agent answers in the thread.
- It never sends silently: the question appears in the conversation, in the person's name.

## Surfaces

- **Console** and **Mobile**: present when the product has an assistant and the person has not switched it off (`ConsoleSurface`, in the shell); a press opens the panel (the column from 1024px, the sheet below) and sends the question. Absent otherwise.
- **Embed**: on cards, whenever a host is connected.

## Agents

This is the person-to-agent handoff. The view has already shared its context (`useShareView`), so the agent can answer about "this" without asking what this is.

## Accessibility

- Named by its question ("Ask: Why did requests fall on 27 September?").
- Contrast (dark, indigo): `accent-ink` on surface 9.6:1.

## Content

- The question is concrete and short; it names the figure, the day or the endpoint.

## Do and do not

- Do put it only on cards whose content a person might reasonably question.
- Do not use it to send commands; a write goes through a tool and comes back as a Proposal.

## Implementation

```tsx
import { AskAbout } from '@/components/patterns/ask-about';

<CardHeader title="Requests per day" actions={<AskAbout question="What drove the trend in requests this period?" />} />
```

In a list's toolbar, pass it to `FilterBar`'s `ask`, which keeps it in the row on a phone. A settings page is built of Form sections and has no card head, so its Ask goes in the first section's `actions`, which keep it on the title's row on a phone:

```tsx
<FormSection title="Workspace" description="What this workspace is called." actions={<AskAbout question="What do these settings change for this workspace?" />}>
```
