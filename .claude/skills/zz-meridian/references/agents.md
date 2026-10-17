# Agents

The rules for an agent in a Meridian product, as a guide for whoever builds it. Paths marked `example:` or `optional:` are in the template or in some projects only.

How a Meridian dashboard works with an agent: an AI assistant that reads the dashboard and acts on it through tools, under five rules, each enforced by a part of the system.

Agents work in two places: an MCP host, a chat where the dashboard appears as an MCP App, and the console's own assistant, one panel in the dashboard shell that reads the page the person is on (`example:docs/assistant.md`). The agent gets no separate interface. It uses the same views a person does.

## The model

A person asks the agent something in a chat ("how is the company doing this month?"). The agent calls a tool on the product's MCP server (`zz_meridian_home { period: "30d" }`). The tool returns data and names a `ui://` resource; the host renders that resource, which is one of this template's `app/embed/*` routes, in a sandboxed frame beside the answer. From then on there are two operators on one view: the person points, taps and asks; the agent reads what the view shares and proposes what to do.

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

**In the system:** a view's context is built by a pure function beside it (`example:src/views/home-context.ts`) and passed to `useShareView(context)`. In an MCP host that sends `ui/update-model-context`, debounced, once a host is connected; on the console the assistant reads the same context with the person's next question. `contextText` writes it as labelled lines for a model; the structured part mirrors them, but the text stands alone, because a host need not give the model the structured part.

### 3. Consent

An agent may read anything the person may read. It changes nothing without the person. Every write the agent wants arrives as a **Proposal**: what will change, from what to what, why (with the evidence it used), and what else it touches. Approve runs it once; Dismiss closes it. The person can always see the before and the after before agreeing.

A removal (revoke, delete) is proposed like any other change: the Proposal is marked critical, says what will be removed, and runs only when the person approves it. In the console's assistant the approval is signed by the server, so a forged one never runs. What only a page may do stays off every agent's reach (`pageOnly` in `example:docs/assistant.md`).

**In the system:** `Proposal` (pending, applying, applied, dismissed, failed, expired); `optional:app/embed/proposal` shows one end to end in a host; the assistant panel draws the same card in its thread.

### 4. Provenance

Whatever an agent did stays marked. An activity line names the agent and the person it acted for ("Claude raised the rate limit for Parallax AI · for Jonas Weber"). A filter or a view an agent set says so ("Set by Claude") until a person changes it. Agents are drawn as a square mark, never as a round avatar: a reader tells a person from an agent at a glance.

**In the system:** `AgentMark`, `ActivityFeed`'s `via`, `FilterBar`'s `setBy`, and the assistant's `record`, which writes the Activity line once an approved change commits (decision 0011).

### 5. Handoff

A person hands any card to the agent with one press. **Ask** posts a question about exactly what the card shows into the conversation, as the person, so the thread reads naturally, and the view's shared context goes with it, so the agent and the person mean the same thing by "this". In an MCP host it posts into the chat; on the console it opens the assistant panel and sends there. It appears only where an agent is listening; the console never shows a control that does nothing.

**In the system:** `AskAbout` (renders nothing unless `useSurface().ask` exists, and nothing before hydration); `ConsoleSurface` gives the console an `ask` when the product has an assistant the person has not switched off. Every page's protagonist, the card worth asking about, carries one, so each page hands what it shows to the agent: the page marks it `data-protagonist="<name>"`, with the name its specification's `Protagonist:` line gives, on a wrapper whose display is `contents` (in a `2/3` or `1/3` row, where the row gives its first or last card the wider span, the wrapper is itself that grid item, `flex min-w-0 flex-col` with its card stretched to fill it: a `contents` wrapper draws no box, so the span would land on nothing); `AskPeriod` (`optional:src/views/ask-period.tsx`) asks about the day the Meridian points at, or else the period.

## Writing for the model

- Name the period and the unit every time: "2.94M requests in the last 30 days", not "2.94M".
- Prefer facts to adjectives: "errors rose from 0.6% to 2.1% on 21 and 22 September", not "errors spiked".
- Share what the person may read, and what code derives from it, nothing more. A baseline, a deviation, a ranking or a share computed from data in the view's scope is context: it is how the agent points at what is in front of the person but not obvious. A `hidden` field, another tenant's data, what only a page may show, and a count that would disclose any of them are never context. A derived figure names its method and window and is never finer-grained than what the person may read. A column the layout dropped for width is still the person's to read (decision 0011).
- Code computes, the model interprets: every figure the agent quotes arrives computed in the context; the model explains what it might mean.
- Keep the context's shape stable: the same lines in the same order every turn, so a model compares one turn with the next. Send the whole state, never only what changed: a host keeps only the latest update.
- Say what the data cannot say: a partial day, a tiny sample, a spike nothing recorded explains. A gap left unsaid is filled with a guess.
- Lead with what the page is headed by. A page whose title is a sentence about its figures puts that sentence first among its insights, word for word, and after it each fact its rules found: the kind's name, then the rule's own line, with the address that shows it when it has one ("Steady: 357 of 360 days inside the band of p95 under 350 ms and errors under 1%; outside it on 17 Aug 2026, 21 Sept 2026 and 22 Sept 2026. Evidence: /services"). The context's `title` stays the page's name. So what a person reads at the head of the page is what an agent is told first, and neither is told a fact the other is not (`example:docs/data-display.md`, "Facts").
- Work a title and a fact out where the history is. The days a record, a first or a total needs are read on the server, once a request, and never handed to the browser: a view's read returns the sentences (`head` on its data: the title, each fact's line, and what to say when the history could not be read), and the context is built from those. The browser and the view tool then share the same text, and a page's payload does not grow with the history. `factInsight` in `optional:src/views/fact-insight.ts` turns a rule's fact into an insight.
- Count a period in complete days. The sample's periods are the 7, 30 or 90 complete days up to yesterday, or every complete day kept for `all`, which has no period before it and so no change: `readDays(period)` in `optional:src/data/metrics.ts` returns those days, the same number before them, both totals, and the day in progress on its own. The day in progress is in no total, change or finding, and Home's context says so. The last rows of the sample's `days`, `usage`, `compute` and `costs` collections may be that day, and their `description` says so — for the people who build on the collection, because no collection's description reaches a model: say it again in a view's context or a source's `cannot`, or the agent summing one is never told (`example:docs/agents.md`).

## Prepared queries

A view's context says what the page shows. A question the context does not answer alone ("how many requests came at 22:00 on each weekday?") is asked of the page's prepared query: what the page's author lets an agent count, group and compare over the page's own collections, declared beside the view as `explore` on its view tool (`PreparedQuery` in `src/lib/explore.ts`). Code still computes and the model still interprets: the collection works the figures out, and the agent never counts rows itself.

Every view tool declares one. `explore` is required on `defineViewTool`, so a view without it fails the type check, and `optional:tests/explore-contract.test.ts` fails it too. A product's own view declares its prepared query beside its page, as the sample's do (`example:src/views/<view>-explore.ts`), and the page's specification says what it is for: under `## Agents`, a section `### What the agent does here` names the page's protagonist (`Protagonist: <name>.`) and lists at least three questions a person on the page asks that its context does not answer alone, each with what the prepared query is asked (`- "<question>" — <what is asked>`). `node scripts/check.ts` fails the specification of a page with a view tool that lacks the section, its Protagonist line or three questions in that form; Settings, the Atlas, Docs and the embed views have no view tool of their own and carry none.

A prepared query names at most five sources. Each is one collection with:

- `date`, the field a window is cut on; a source without one has no window and no window before;
- `filters`, the fields that narrow it, each with its operators (`eq`, `ne`, `in`, `lt`, `gt`) and, where it has them, its values;
- `facets`, the fields that group it, and `buckets`, the time buckets of its date (day, week, month, weekday);
- `measures`, each with its label, unit and definition: a count (of the rows that meet conditions the author declares, when it has them), a field's sum, average, minimum, maximum or p95 (a field may be a path, such as `revenueByPlan.Enterprise`), or a ratio `a / (b * scale)` or a margin `(1 - b / a) / scale` of two measures, of this source or `<source>.<measure>` of another, read over the same window on that source's own date, where a margin takes a `scale` as a ratio does (1 when not given, `0.01` to state it in %);
- `drill`, the columns of a row, the collection's key among them, and the console address that opens it;
- `cannot`, what its answers cannot say, in the words the page's context uses; `labels`, how a facet's value reads (the hours' weekday `6` reads Sunday); `none`, how a field's missing value reads by field (a request that reached no model is `no model`), which is also what admits a condition naming it as null; and `refers`, a field that holds another collection's key and how that record reads, so a run's `releaseId` is named with its release's version.

A detail page's query adds `fixed`, which turns the view's own input (One customer's `{ id }`) into each source's conditions, so every answer is about the record the page shows. `address` says which console address shows what a call asked; without it, an answer names the page's own.

An agent asks it as the read-only tool `explore_<view>`. Its input is one object: `{ source, measures (one to three), where? (up to four conditions), by? or bucket? (never both), period? ('7d', '30d', '90d' or 'all'; 30d when not given), compare?, rows? (0 to 20; none when not given) }`, with a detail page's own input beside it. It may name only what the query declares, and it is checked against the named source's own declaration, so a name the query lacks, a facet of another source or a period on a source with no date is refused. The schema is the person's: a source over a collection they may not read, and a measure, filter or facet over a field hidden from them, is left out; a call that names one anyway is answered "You do not have access to that." and reads nothing. Its JSON Schema stays under 6,000 characters.

The answer is text of at most 3,000 characters, in a fixed order: the window as its first and last complete days, and the conditions; each measure with its label, value, unit and definition; the window before and the change, when asked, a margin's in percentage points to one decimal ("up 2.5 points", or "unchanged" under 0.05) as Home states its gross margin, and every other measure's as a percent of the window before; at most eight groups, largest first, each with its own figure in the window before and its change when the call compares (a group missing from the window before's own groups reads "none in the window before" when that window folded none into its others, and states no figure when it folded some, since the group may be among them), or the latest eight buckets in date order (a weekday Monday to Sunday), which state no change of their own; the rest on one line with their own figures; what the source cannot say; then the rows, each with its console address. Figures are written in full, with at most two decimals. Rows that do not fit are dropped from the end, and a last line says how many. The tool returns the answer with an `address`. A call reads through one `aggregate` for each source and window (the window before is a second, and a measure over another source adds that source's) and one `read` for its rows, through `aggregate()` and `read()` in `optional:src/data/read.ts`, so the person is checked again when it runs.

## The console's own assistant

The second place is inside the product. The assistant panel reads the page the person is on (its address with the query, the view's shared context, then the visible text), reads further through every `view_<name>` and the page's own prepared query, and proposes changes as Proposals in its thread. It is handed that page's `explore_<view>` and no other page's: the route finds the view whose `page`, the console route of the page it renders, is the address the panel sends, and hands its prepared query only where the person may use that view. There is no tool that reads a collection directly. Its write tools are those of the collections that prepared query reads, among the product's collections (`optional:src/data/collections.ts`), so the members' writes are handed on Members and the key writes on API keys; a change takes the ids the query's drilled rows give, and asked for a change another page makes, the assistant gives that page's address. A rail page's `page` is its `href` in `nav`; a detail page's has its segment (`/customers/[id]`) and matches any one segment there, and a catch-all matches as Next.js matches it: `/docs/[...path]` any depth under `/docs/`, `/docs/[[...path]]` `/docs` as well. Where two views match one address, the one Next.js renders is chosen (`viewAt` in `src/lib/shared-context.ts`). It follows the same rules: it reads what the person may read, changes nothing without approval, and leaves its mark (the Agent mark and the "Assistant" caption). It is off until a model is configured. `example:docs/assistant.md` says how to switch it on and point it at your data, and how the same tools can later be offered from an MCP server.

## Building an MCP server for the template

The template ships the views and their tool contracts; the server is yours. Every view's contract is in `example:src/views/tools.ts`: its `name`, the question it answers (`description`), the console route of its page (`page`), its address as a zod `input`, its `resourceUri` when it has an embed route, one `read` that returns what the view renders (`data`) and what both agents are told (`context`), and its prepared query (`explore`), which every view declares. The console's assistant offers each one as `view_<name>`, but registers it only where the caller satisfies that view's need (`may(v.needs)` in `optional:app/api/assistant/route.ts`); register the same list, filtered the same way:

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

A host has no page the person is on, so an MCP server may register every view's prepared query, each with the caller's own schema. `rights` are the caller's: the collections they may read, and each one's `hidden` fields.

```ts
import { may } from '@/data/access';
import { clock } from '@/data/collections';
import { aggregate, read } from '@/data/read';
import { exploreSchema, runExplore, type ExploreRights } from '@/lib/explore';

declare const rights: ExploreRights; // { readable: the collections the caller may read, hidden: (name) => that collection's hidden fields }
for (const v of viewTools) {
  if (!(await may(v.needs))) continue;
  // A query none of whose sources the caller may read offers them nothing.
  if (!Object.values(v.explore.sources).some((s) => rights.readable.has(s.collection))) continue;
  // A detail page's own input (its `id`) is offered beside the query and handed to its `fixed`.
  const own = v.page.includes('[') ? v.input : undefined;
  server.registerTool(`${toolPrefix}_explore_${v.name}`, {
    description: `Count, group and compare what the ${v.title} page reads.`,
    inputSchema: z.toJSONSchema(exploreSchema(v.explore, rights, own)),
    annotations: { readOnlyHint: true },
  }, async (input) => {
    const today = clock().toISOString().slice(0, 10);
    const { address, answer } = await runExplore(v.explore, input, rights, { aggregate, read, today }, v.page, own);
    return { content: [{ type: 'text', text: `${answer}\nAddress: ${address}` }] };
  });
}
```

1. For each `resourceUri`, register a resource with `mimeType: "text/html;profile=mcp-app"`. Its content is the built HTML of the embed route (or a small HTML document that loads it from your deployment, allowed by the resource's CSP). The route renders from the tool's own `read`, so the model and the view start from one read.
2. Run every `read` with the MCP caller's scope, as the assistant route runs it with the console's: `read()` asks `resolveAccess()` and `can()`, so a caller sees only what they may read, and a `hidden` field is never in a context. A grant need not be every role's: the sample's `costs` collection, what compute cost each day, is read under `costs:read`, which only an Owner and an Admin carry, so nobody else is offered a query of it and a read without the grant is the same `AccessDenied` as any other. Re-check that scope at execution, not only when the tool list was built: a caller may be suspended or demoted in between. A view's `read` and a prepared query's call both read through `read()` and `aggregate()` in `optional:src/data/read.ts`, which resolve the caller and ask the read grant at the moment they run, so read through those and never through a collection's own `query`.
3. **A write is a pair of tools, and only one is the model's.** The model calls a read-only `propose_…` tool that returns the Proposal view; the person's Approve in that view calls the apply tool through the host (`tools/call`). Register the apply tool with `_meta.ui.visibility: ["app"]`: the specification requires a host to leave such a tool out of the model's list, so the model cannot run a change by itself. Sign what the propose tool returns and check the signature, the run-once rule and `can` again in the apply tool, as the console's assistant does (`example:docs/assistant.md`).

The view's side is already done: `EmbedSurface` performs `ui/initialize`, applies the host's theme and style variables, reports its height, and exposes `expand`, `ask`, `share` and `openLink` through `useSurface()`; every view shares its context with `useShareView`. To use the official SDK instead of the built-in bridge, replace `src/lib/host.ts` with `@modelcontextprotocol/ext-apps`; no component changes.
