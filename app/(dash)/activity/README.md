# Activity

Every tool call, gate and admin act the platform recorded, newest first.

## Structure

- Gate first: the page asks for `activity` before it renders, so a person who does not hold it is shown NoAccess and nothing on the page is read.
- Show everything or refusals only.
- A data table: when, kind, subject, actor, team, result, refusal; a refusal is the one row in colour.

## States

- Loading: skeleton rows.
- Empty: nothing recorded yet.
- Refusals only, none: Clear filters.

## Agents

The assistant reads this page and changes nothing: every change in this console is made on a page, by the person. The page shares its context through `activityContext` in `src/views/activity-context.ts`, the same function `view_activity` calls, so the assistant quotes the figures the screen shows. Ask is in the head of the Events table: what stands out in the latest events and whether anything is being refused, or, with Refusals only, which of the latest refusals matter most and what would stop them.

### What the agent reads

Whose events these are, whether only refusals are shown, the span the list covers, and how many events and refusals are in it. What code found: the count by kind and by actor, how many were refused and on what, the commonest refusal messages, and the newest events. It says that only the latest 200 are here, so every count is of those and never of all time, and that an event with no team is not missing data.

```text
- 6 of these 120 events were refused (5%), most on core:document_read 2, core:document_edit 1, core:knowledge_search 1, core:document_approve 1, eval:finding_record 1. Evidence: /activity?show=failed
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address and query, and the page text after it for anything the context does not cover. `query_activity` looks up what the page lists.

## Surfaces

Console, desktop and phone. Reads `GET /activity?limit=200`.
