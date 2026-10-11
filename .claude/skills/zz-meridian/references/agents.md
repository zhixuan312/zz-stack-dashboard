# Agents

The rules for an agent in a Meridian product, as a guide for whoever builds it. Paths marked `example:` or `optional:` are in the template or in some projects only.

How a Meridian dashboard works with an agent: an AI assistant that reads the dashboard and acts on it through tools, under five rules, each enforced by a part of the system.

Agents work in two places: an MCP host, a chat where the dashboard appears as an MCP App, and the console's own assistant, one panel in the dashboard shell that reads the page the person is on (`example:docs/assistant.md`). The agent gets no separate interface. It uses the same views a person does.

## The model

A person asks the agent something in a chat ("how is the API doing this month?"). The agent calls a tool on the product's MCP server (`zz_meridian_overview { period: "30d" }`). The tool returns data and names a `ui://` resource; the host renders that resource, which is one of this template's `app/embed/*` routes, in a sandboxed frame beside the answer. From then on there are two operators on one view: the person points, taps and asks; the agent reads what the view shares and proposes what to do.

```
person ──asks──▶ agent ──calls tool──▶ MCP server ──returns ui:// view──▶ host frames it
   ▲                                                                      │
   └──────────── points, taps, presses Ask or Approve ◀──────── Meridian view
```

## The five rules

### 1. Addressable

Every view's state lives in its address: the period, the filters, the sort, the page, the selected record. Console routes read it from query parameters; embed routes take the same names as tool arguments. An agent never navigates by clicking: it opens exactly the view it means. A person can paste the link of any view into the chat and the agent can open the same thing.

**In the system:** `PeriodSelect` writes `?period=`; `DataTable`'s query-state hook writes `?q=&sort=&page=`; embed pages read `searchParams`.

### 2. Legible

Every view tells both agents what is on screen in one shared context (decision 0011), and tells them again when that changes: a filter, the period, the day the Meridian points at. "Why did this spike?" then has a referent, and the agent answers about the day the person is looking at, not the one it guessed. The context is the whole state every time: its address and scope, how fresh the data is, what the person points at, each figure with its unit, its change and its definition, what code computed from them (a baseline, a deviation, a share, with the address of its evidence), and what the data cannot say.

**In the system:** a view's context is built by a pure function beside it (`example:src/views/overview-context.ts`) and passed to `useShareView(context)`. In an MCP host that sends `ui/update-model-context`, debounced, once a host is connected; on the console the assistant reads the same context with the person's next question. `contextText` writes it as labelled lines for a model; the structured part mirrors them, but the text stands alone, because a host need not give the model the structured part.

### 3. Consent

An agent may read anything the person may read. It changes nothing without the person. Every write the agent wants arrives as a **Proposal**: what will change, from what to what, why (with the evidence it used), and what else it touches. Approve runs it once; Dismiss closes it. The person can always see the before and the after before agreeing.

A removal (revoke, delete) is proposed like any other change: the Proposal is marked critical, says what will be removed, and runs only when the person approves it. In the console's assistant the approval is signed by the server, so a forged one never runs. What only a page may do stays off every agent's reach (`pageOnly` in `example:docs/assistant.md`).

**In the system:** `Proposal` (pending, applying, applied, dismissed, failed, expired); `optional:app/embed/proposal` shows one end to end in a host; the assistant panel draws the same card in its thread.

### 4. Provenance

Whatever an agent did stays marked. An activity line names the agent and the person it acted for ("Claude raised the rate limit for Parallax AI · for Jonas Weber"). A filter or a view an agent set says so ("Set by Claude") until a person changes it. Agents are drawn as a square mark, never as a round avatar: a reader tells a person from an agent at a glance.

**In the system:** `AgentMark`, `ActivityFeed`'s `via`, `FilterBar`'s `setBy`, and the assistant's `record`, which writes the Activity line once an approved change commits (decision 0011).

### 5. Handoff

A person hands any card to the agent with one press. **Ask** posts a question about exactly what the card shows into the conversation, as the person, so the thread reads naturally, and the view's shared context goes with it, so the agent and the person mean the same thing by "this". In an MCP host it posts into the chat; on the console it opens the assistant panel and sends there. It appears only where an agent is listening; the console never shows a control that does nothing.

**In the system:** `AskAbout` (renders nothing unless `useSurface().ask` exists, and nothing before hydration); `ConsoleSurface` gives the console an `ask` when the product has an assistant the person has not switched off.

## Writing for the model

- Name the period and the unit every time: "2.94M requests in the last 30 days", not "2.94M".
- Prefer facts to adjectives: "errors rose from 0.6% to 2.1% on 21 and 22 September", not "errors spiked".
- Share what the person may read, and what code derives from it, nothing more. A baseline, a deviation, a ranking or a share computed from data in the view's scope is context: it is how the agent points at what is in front of the person but not obvious. A `hidden` field, another tenant's data, what only a page may show, and a count that would disclose any of them are never context. A derived figure names its method and window and is never finer-grained than what the person may read. A column the layout dropped for width is still the person's to read (decision 0011).
- Code computes, the model interprets: every figure the agent quotes arrives computed in the context; the model explains what it might mean.
- Keep the context's shape stable: the same lines in the same order every turn, so a model compares one turn with the next. Send the whole state, never only what changed: a host keeps only the latest update.
- Say what the data cannot say: a partial day, a tiny sample, a spike nothing recorded explains. A gap left unsaid is filled with a guess.

## The console's own assistant

The second place is inside the product. The assistant panel reads the page the person is on (its address with the query, the view's shared context, then the visible text), looks records up through the product's collections (`optional:src/data/collections.ts`) and proposes changes as Proposals in its thread. It follows the same rules: it reads what the person may read, changes nothing without approval, and leaves its mark (the Agent mark and the "Assistant" caption). It is off until a model is configured. `example:docs/assistant.md` says how to switch it on and point it at your data, and how the same tools can later be offered from an MCP server.

## Building an MCP server for the template

The template ships the views and their tool contracts; the server is yours. Every view's contract is in `example:src/views/tools.ts`: its `name`, the question it answers (`description`), its address as a zod `input`, its `resourceUri` when it has an embed route, and one `read` that returns what the view renders (`data`) and what both agents are told (`context`). The console's assistant already offers each one as `view_<name>`; register the same list:

```ts
import { z } from 'zod';
import { toolPrefix } from '@/app.config';
import { contextText } from '@/lib/shared-context';
import { viewTools } from '@/views/tools';

for (const v of viewTools) {
  server.registerTool(`${toolPrefix}_${v.name}`, {
    description: v.description,
    inputSchema: z.toJSONSchema(v.input),
    annotations: { readOnlyHint: true },
    ...(v.resourceUri ? { _meta: { ui: { resourceUri: v.resourceUri } } } : {}),
  }, async (input) => {
    const { context, data } = await v.read(v.input.parse(input));
    // `content` is what the model reads; `structuredContent` is the view's data, which the specification keeps out of
    // the model's context. The text therefore carries everything.
    return { content: [{ type: 'text', text: contextText(context) }], structuredContent: data };
  });
}
```

1. For each `resourceUri`, register a resource with `mimeType: "text/html;profile=mcp-app"`. Its content is the built HTML of the embed route (or a small HTML document that loads it from your deployment, allowed by the resource's CSP). The route renders from the tool's own `read`, so the model and the view start from one read.
2. Run every `read` with the MCP caller's scope, as the assistant route runs it with the console's: `read()` asks `resolveAccess()` and `can()`, so a caller sees only what they may read, and a `hidden` field is never in a context.
3. **A write is a pair of tools, and only one is the model's.** The model calls a read-only `propose_…` tool that returns the Proposal view; the person's Approve in that view calls the apply tool through the host (`tools/call`). Register the apply tool with `_meta.ui.visibility: ["app"]`: the specification requires a host to leave such a tool out of the model's list, so the model cannot run a change by itself. Sign what the propose tool returns and check the signature, the run-once rule and `can` again in the apply tool, as the console's assistant does (`example:docs/assistant.md`).

The view's side is already done: `EmbedSurface` performs `ui/initialize`, applies the host's theme and style variables, reports its height, and exposes `expand`, `ask`, `share` and `openLink` through `useSurface()`; every view shares its context with `useShareView`. To use the official SDK instead of the built-in bridge, replace `src/lib/host.ts` with `@modelcontextprotocol/ext-apps`; no component changes.
