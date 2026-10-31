# The data layers

A dashboard's figures come from somewhere. This is the standard for the path between that somewhere and the screen: four layers — one kind of module each, with one job and one direction it may import — that a Meridian product keeps between its database and what a person sees, the contract it asks of any backend, and the ordered path a project with its own tables and API follows to reach it.

It is advice, not a gate. Nothing here runs by itself. One part is held by a machine — the six rules in
`node scripts/check.ts` — and only once a project turns them on with its own switch — one exported declaration in a file
the project owns, which no update overwrites. Every other rule is a recommended default with a cost attached, and a team
may disagree with any line in writing, on the line, rather than obey it silently.

The standard ships twice. An adopter's agent reads it with the skill; this repository serves the same text. Both carry
the same words, so a rule you read here is the rule your project's copy carries.

## The four layers

A **layer** is one kind of module with one job and one direction it may import. A Meridian product keeps four, from the
database up.

A **record** is one row as it was written. A **read** is a request for records, answered by the data layer under the
caller's access. A **scope** is who is asking and what they may see — the **tenant**, the customer whose rows the scope
isolates, the person, and an authorization key that changes when what they may see changes — and it is resolved on the
server, never chosen by a page. The **read surface** is the functions that make a read — `read()`, `readAll()`,
`aggregate()` and the forms that take a scope beside them. A **projection** is the public object a record becomes on its
way to a client, built field by field rather than by erasing fields from a type.

| Layer | What it is | What it owns | May import |
|---|---|---|---|
| L1 The database | The adopter's own store, reached through its API, an ORM or a driver | Tables, schema, migrations, indexes, transactions | nothing in this tree |
| L2 `optional:src/data/` | The backend data layer: the one place a backend is touched | Reading records, the access policy, the write boundary, the projections a record passes through, the read surface (`read()`, `readAll()`, `aggregate()` and the scope-taking forms beside them) | L1 and shared helpers (`src/lib/`); neither `optional:src/logic/` nor `src/views/` |
| L3 `optional:src/logic/` | The business logic: what the records mean | Every figure with a product definition — a total, a rate, a trend, a status, a threshold, a sentence built from records — and the prepared queries and tools built on them | L2, `src/lib/` and other logic modules; no view |
| L4 Presentation | `src/views/`, `src/components/`, `app/` | Drawing: the frame, the cards, the routes, the shell | everything below it; it renders what it is handed |

The direction is the point. L1 answers L2, L2 feeds L3, L3 feeds L4, and nothing above reaches past the layer beneath
it. A page that queries a collection, or a card that sums what it was handed into a figure, is the presentation layer
doing L2's or L3's job.

### The six rules, and the switch

`node scripts/check.ts` checks six rules over the tree. Every one of them is off until the project says otherwise: the
switch is one exported declaration in the team's own `optional:scripts/check.local.ts`, and until it is set the check
says nothing about the layers and runs exactly as it did before. The switch is described under "The two places you may
deviate".

| Rule | Refuses | Shipped in |
|---|---|---|
| `data-imports-neither` | an import in `optional:src/data/**` that resolves into `optional:src/logic/` or `src/views/` | `scripts/check.ts` |
| `logic-does-not-import-views` | an import in `optional:src/logic/**` that resolves into `src/views/` | `scripts/check.ts` |
| `views-produce-nothing` | a file under `src/views/` that is not a renderer: a `.tsx` with no default export and no named export whose identifier starts with a capital letter, or any non-`.tsx` file but `workspaces.ts` | `scripts/check.ts` |
| `presentation-does-not-read` | a value import from `@/data` in `src/views/**` or `src/components/**` naming any module but the five vocabulary modules — `roles.ts`, `features.ts`, `sample.ts`, `request-methods.ts`, `live-actions.ts` | `scripts/lib/layer-rules.ts` |
| `no-direct-query` | a `.query(` call on a collection in `app/**`, `optional:src/logic/**`, `src/views/**` or `src/lib/**`, except on a line that states `allow-no-direct-query: <why>`, as the five sites below do — the other two of the seven direct reads live in `optional:src/data/access.ts`, which this rule does not govern | `scripts/lib/layer-rules.ts` |
| `client-does-not-import-a-reading-module` | a `'use client'` module that value-imports a logic module whose own imports reach a module that reads (`read(`, `readAll(`, `aggregate(`, `collectionFor(`, `resolveAccess(` or `can(`) | `scripts/check.ts` |

A type import is erased before anything runs, so it is not a value import. Comments are blanked before a scan, so a call
a document quotes in prose is not a violation. A `'use server'` module is a reference in the browser and not its body, so
a client module may import one that reads.

## Which situation are you in?

Find the one that describes you, and follow the arrow.

- **No backend yet** → The contract a backend answers
- **An API to call** → The path an existing product follows
- **A database and no API** → The path an existing product follows
- **An answer too slow to compute on every request** → Whether to precompute: a decision, not a rule

## The contract a backend answers

Whatever the store — a Postgres database, an HTTP API, a set of files — the data layer asks it the same things. This is
a seam, not a storage design: it describes the shape of an answer, and never a table.

**A read answers its rows with a total, a change marker and the moment the read ran.** `read(name, query)` answers
`{ rows, total, revision?, observedAt }`: the page of rows the question keeps, how many rows it keeps in all, the state
the caller read, and when the read ran. `readAll()` answers every row with the same marker and the same moment, and
`aggregate()` answers a figure over every row the same way.

**Authorization happens before any cache** — a copy kept to save work, correct only while nothing it was made from has
changed. A read asks whether the scope holds the grant before any cached code runs; a scope without it is refused, and
nothing is read or served from a cache on its way out. The cache is keyed by tenant and collection, so it can never
answer a person who could not have asked.

**A write is validated and names the reads it invalidates.** A write parses its input against the collection's fields —
a derived field is not writable — authorizes the operation, commits, and then drops the answers its change makes wrong:
`invalidate(collectionTag(tenantId, name))` (`optional:src/data/write-boundary.ts`) retires that collection's cache entries for that
tenant and nobody else's: `updateTag` from a Server Action, `revalidateTag(tag, { expire: 0 })` from a route handler or an
MCP server, where `updateTag` throws.
Rows, totals and aggregates are all retired by the same name.

**Absent evidence is `null`, never zero.** A quantity nothing measured is `null`, and the formatters render it as a dash.
Zero means zero was measured; the two are never the same answer.

**An answer declares whether it is a record or a derived answer — an answer computed from records, not stored as one.**
A record is returned as it was written. A derived answer carries, in its own payload, the moment it was built and the
source state it was built from.

### Four times and versions, kept apart

These names are not interchangeable, and a document that runs them together gets the answer wrong.

- **Observed** is when the read ran (`observedAt`). It is the only time a read can speak for.
- **Observed revision** is the change marker that read saw (`revision`): the state of the records it was answered with.
- **Built** is when a derived answer was computed (`builtAt`).
- **Source revision** is the state a derived answer was computed from (`sourceRevision`).

A read cannot speak for a build it did not perform. A figure built at 09:00 and read at 13:00 reports 09:00; the read's
own moment says only that the page asked at 13:00. A repeat read that rebuilt nothing returns the same `builtAt`, and a
rebuild that failed leaves the previous answer standing with its own moment rather than relabelling a stale result as
fresh.

`revision` is optional, and the standard does not assume it. A backend with no change marker to give leaves it out; a
reader that needs to know whether the records moved — the live stream, or a derived answer's own source — compares
against the read's `observedAt` instead, the way `optional:src/data/uptime.ts` does. A marker is also not a snapshot guarantee:
this repository takes one revision before a paged read and does not verify that the later pages share it. A backend that
can promise a snapshot says so of itself; the contract asks for a marker, not for a snapshot.

### What this leaves to you

Schema design, migrations, indexing, transactions, materialization strategy and multi-tenancy are yours. Whether a
derived answer is a materialized view, a rollup table, a cached query or a cron job is your choice, and the standard
never implies a preferred store.

The in-process collection store in `src/lib/collection.ts` is the **reference implementation** of this contract: rows, a
total, a change marker and a derived field, all in one process's memory, with the read surface above it adding the
moment, the authorization, the cache and the invalidation. It is what you can delete once your own client answers the
same questions. `optional:src/data/` is the only place your backend is touched: a page, a view, a logic module and the assistant
never see a client, a connection or a query string.

## Records and derived answers

Two kinds of answer come out of the data layer, and they belong to different places.

- **Records** are rows as they were written. Only the data layer writes them.
- **Derived answers** are computed from records, and carry how they were built and how stale they may be. The layer that
  defines one owns it: the module that names the answer says what its source is and what its build is, and whoever needs
  the figure reads the answer rather than recomputing it.

### Three derived things, not one

All three save work, and they are easy to confuse. What separates them is what has to survive.

| Thing | What it is | Where it lives | May it be thrown away? |
|---|---|---|---|
| Field | A derived field: a value computed once, at write, and stored on the record — a score, a band, a name joined in from another table. It is part of the record, and no write can set it. | On the record: the collection lists it in `derived`, and `patchOf` builds a write's shape from `fields` alone | No. It is part of the record |
| Answer | A derived answer: an answer rebuilt from records, carrying the moment it was built and the source revision it was built from. | `optional:src/data/derived.ts`, and the module that names one answer, such as `optional:src/data/uptime.ts` | It is rebuilt when its source moves. Until then the previous answer stands, with its own moment |
| Cache | A cache: a copy kept to save work, correct only while nothing it was made from has changed. | The cached path inside `optional:src/data/read.ts`, tagged by tenant and collection, retired by a write | Yes, at any moment: a miss costs time, never correctness |

### Whether to precompute: a decision, not a rule

Whether an answer is precomputed is decided by four things: what computing it costs, how often it is read, how often its
inputs change, and how stale it may be.

Being shared and stable is a signal that precomputation is worth considering, not a condition that settles it. A shared
answer that is three additions is computed on read. A per-request answer over an expensive input may be served from a
daily pre-aggregation that the request then narrows. A per-request answer that cannot usefully be precomputed to a grain
is computed at read time. A page never builds either: it reads the answer, or the records it is built from.

### The worked example

`optional:src/data/uptime.ts` builds each service's uptime from the days that service's own record keeps, through
`derivedAnswer()` in `optional:src/data/derived.ts`, rather than reading an uptime stored beside them. Its source is the services
collection, read through `readAllInScope(scope, 'services', …)` on the scope the answer is keyed by — the answer is held
per tenant, so one tenant's rows are never served from another's build — and the revision that read answers is what makes
an unchanged source recognisable without building again. `optional:app/(dashboard)/services/page.tsx` reads the answer's payload —
its data and its `builtAt` — instead of computing an uptime at render, and a write to any other collection never re-stamps
it.

## Where this sits among the content layers

Meridian's `README.md` numbers six content layers: 0 Tokens, 1 Base, 2 Components, 3 Patterns, 4 Pages and 5 Product
workspaces. They describe how a surface is composed — a value, a part, a pattern, a page, how a product assembles its
pages.

The four data layers describe something else: where an answer comes from. A data layer is **not a content layer**, and
adding one adds nothing to that count. The two lists answer different questions, and a project keeps both: a new
component is a content-layer question, and where its number came from is a data-layer one.

## Every rule, and what deviating costs

Each rule below is a recommended default. It says what to do, what skipping it costs, and how to deviate — in that
order, because a default that cannot be said in one line is not a default. The two ways to deviate are the same for
every rule.

### The two places you may deviate

1. **On the line.** Write `allow-<rule>: <reason>` on the offending line, with the rule's own name. For
   `views-produce-nothing`, which refuses a file rather than a line, it goes on the file's first line. An **escape** is
   that named exception, written with its reason. The check prints it as `escape  <file>:<line>: <rule> — <reason>`
   after its problem list, leaves the exit status and the `n problems` summary unchanged, and the run passes. The reason
   is a sentence the next reader can check, and the deviation is visible on every run — which is the difference between
   an escape and silence.
2. **In your own check file.** `optional:scripts/check.local.ts` is yours: it is team-local and an update never
   overwrites it. It does two things: it carries the switch (`export const fourLayers = true`) and it may add checks of
   your own, which the gate runs as a step of its own. It can turn a rule on or off as a whole. It cannot override a
   shipped rule's predicate, so a deviation from a rule that is on is written on the line, with a reason.

The switch is read as text, once, at start-up, and only an exported declaration assigning `true` or `false` counts. A
file that merely names `fourLayers` prints one note and leaves the rules off; a comment cannot turn them on.

### What each rule asks, and what skipping it costs

**`data-imports-neither`.** Keep the data layer answering rows and reasons, and derive above it. *Skipping it costs:*
a derived figure that reads records can be called from anywhere, including a place with no scope in hand, so one total
exists in two places and neither can see the other. *Deviate:* `allow-data-imports-neither: <reason>` on the import's
line.

**`logic-does-not-import-views`.** Let a logic module return values and sentences, never JSX. *Skipping it costs:* the
logic layer drags a view into every consumer that is not a page — a route handler, the assistant's route, a test — so a
module that only counts records carries a browser tree with it. *Deviate:* `allow-logic-does-not-import-views: <reason>`
on the import's line.

**`views-produce-nothing`.** A file under `src/views/` is a renderer; a helper that produces a value belongs in
`optional:src/logic/`. *Skipping it costs:* a module that produces a value cannot be called from a server component, so its logic
is reachable only from the browser and only after hydration. *Deviate:*
`allow-views-produce-nothing: <reason>` on the file's first line.

**`presentation-does-not-read`.** What is drawn takes only a type, or one of the five vocabulary modules, from `@/data`;
records arrive as props or as a promise the page hands it. *Skipping it costs:* a component that reads is tied to one
collection, cannot be given its data, cannot be prerendered inside the page's own boundary, and reads the collection
again for every caller. *Deviate:* `allow-presentation-does-not-read: <reason>` on the import's line.

**`no-direct-query`.** Read through `read()`, `readAll()` or `aggregate()`, or through a named function on that same
surface. *Skipping it costs:* a direct query skips the grant, the cache tag and the invalidation, so a person who may
not read the collection can be answered, and a write invalidates nothing the query answered. *Deviate:*
`allow-no-direct-query: <reason>` on the call's line.

**`client-does-not-import-a-reading-module`.** A client module gets its values as props from the server, or through a
server action. *Skipping it costs:* a reading module in a client's import graph lands the session, credentials and
server-only dependencies in the browser bundle, and the read either fails the build or runs in the browser under the
wrong scope. *Deviate:* `allow-client-does-not-import-a-reading-module: <reason>` on the import's line.

## The seven direct reads

`read()` resolves the request's own scope, which is why a page, a view, a logic module and the assistant can call it and
nobody has to hand it a tenant. Seven sites cannot: each resolves a person, or reads something that must not be cached,
before that resolution is possible. Each says why on its own line, and this is the list:

| Site | Why `read()` cannot serve it |
|---|---|
| `optional:src/data/access.ts`, the member the scope is made from | the member a scope is made from is resolved before an `AccessScope` exists |
| `optional:src/data/access.ts`, the personas the View as menu lists | the personas a scope is made from are resolved before an `AccessScope` exists |
| `optional:app/sign-in/actions.ts` | the sign-in resolves the person before an `AccessScope` exists |
| `optional:app/sign-in/gated-panel.tsx` | the panel lists personas before an `AccessScope` exists |
| `optional:app/(dashboard)/requests/[id]/actions.ts` | a server action reads the record it is about to change, uncached |
| `optional:app/api/export/requests/route.ts` | a streamed export must not be cached |
| `optional:src/lib/assistant/tools.ts` | the proposal path reads the rows a write would change, uncached, to show the person the difference |

Two of the seven are in `optional:src/data/access.ts`, which `no-direct-query` does not govern. The other five state it on the
call's own line, `// allow-no-direct-query: <why>`, which the check prints as an escape; there is no list of sites to
keep, because a list by line number points at the wrong call once a line above it moves. A product whose own page must
read raw does the same: the escape on the call's line, saying why.

The list counts the reads that skip `read()` outside the layer that owns the collections. Inside `optional:src/data/`, the
write boundaries (`member-mutations.ts`, `ticket-mutations.ts`) and the View as switch (`view-as.ts`) also query a
collection directly and uncached: each checks a change against the rows as they are now, the caller through `memberById`
and the services, members and tickets the change names. `no-direct-query` does not govern `optional:src/data/`, so they carry no
escape.

## The path an existing product follows

A project that already has data — its own tables, an API, or pages that query a database directly — does not adopt the
four layers by moving a folder. It follows an order, and each step says what to run to know it worked and what none of
it touches. This is written for the coding agent working in that project: the project's own conventions govern its code,
and Meridian's govern the files Meridian ships.

**1. Replace what `optional:src/data/` reads with your own client.** Keep the read surface — `read`, `readAll`, `aggregate` and
their scope-taking forms — and replace what is behind it: the collections' rows, the adapter, the clock. Your client
answers rows with a total, a marker and a moment, and refuses a read the scope may not make. *Run:* the project's own
suite and `pnpm typecheck`. *Left alone:* your schema, your migrations, your ORM and your API's shape. None of them
changes, and nothing in this path asks you to reshape a table.

**2. Declare a projection for every record that reaches a client.** A projection constructs the public object field by
field, in the data layer, rather than erasing a field from a type: a type-level omission is erased before anything is
serialised, so a record returned as it is ships whatever the row carries. *Run:* the project's own suite and
`pnpm typecheck`; a test that feeds the projection a row with one unexpected field and asserts the key set it returns.
*Left alone:* your schema and your client's shape. The projection is the boundary, not a second model.

**3. Move each computation out of a page or a card into `optional:src/logic/`.** A figure that carries a product definition — a
total, a rate, a trend, a status, a threshold — is computed once, in the logic layer, before it reaches a card. A card
may still compute geometry, scale, ordering, layout and formatting from the values it is given, and may fold a list it
was handed in full into "the rest"; it may not compute a figure it then shows as a fact. *Run:* the project's own suite
and `pnpm typecheck`, then render the pages: the figures are the same as before, and the cards receive them. *Left
alone:* your schema, your API and the pages' addresses. A computation changes owner, not behaviour.

**4. Switch the rules on, last.** This step is the switch, not the folder: step 3 already created `optional:src/logic/`, and a
project that happened to have a folder of that name before it started must not find six rules on without asking. Create
`optional:scripts/check.local.ts` if it is not there and set `export const fourLayers = true`; leave any check of your
own in it as well. *Run:* `node scripts/check.ts`. Fix each line it names, or state an escape with a reason on that
line. *Left alone:* your schema, your migrations, your ORM and your API's shape, exactly as in every step before it.

Until this last step is taken, `node scripts/check.ts` says nothing about the four layers: no rule fires, no note is
printed, and the rest of the check runs as it always did. The rules arrive when you ask for them, not when an update
delivers the check.

The one thing the check holds is the six rules; everything else on this page is a default you may state your way out of,
on the line, with a reason a reader can weigh.

<!-- where: this copy ships with the zz-meridian skill an adopter's agent reads; the repository's own copy is docs/data-layers.md -->
