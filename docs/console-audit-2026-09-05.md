# Console audit — 2026-09-05

Every page and component, checked against what the API actually sends. Prompted by seven
bugs the stakeholder found one at a time; the point of the audit is that they should not
have had to.

## The shape of every bug found so far

All seven were the same fault: **the screen asserted something the data does not say.**
Four classes, and the audit checks every page against all four.

| class | what it looks like |
|---|---|
| **1 · vocabulary literals** | a map or list keyed by one flow's / block's names, applied to all of them |
| **2 · aggregates that drop a dimension** | two judges averaged; two rubric versions unioned |
| **3 · unnamed units** | a time with no zone; a count with no denominator |
| **4 · confident fallbacks** | "no gate" where the truth is "the manifest does not say" |

## What was checked

Eleven endpoints captured live and diffed field-by-field against `src/lib/api.ts` and every
render site: `me`, `overview`, `teams`, `initiatives`, `knowledge`, `skills`, `runs`, `flows`,
`blocks`, `activity`, `people`.

**The captures themselves are not retained.** They were 188KB of live responses from UAT — an
environment decommissioned on 2026-09-10 — and they carried live data.
Nothing read them after this audit closed; the findings below are what the audit produced, and
they stand without the raw material. Re-capturing against the current deployment is one curl
per endpoint if this is ever repeated.

They are not retained anywhere.

## Findings

| # | where | claim | verdict | fix |
|---|---|---|---|---|
| 1 | `console.ts stageOf` | every initiative runs ops-flow: 7 stages, 4 gates | **wrong** | stages and gates from the initiative's own manifest |
| 2 | `Flow.tsx` STAGES / GATE_AFTER / flowCaption | same, in the diagram and its caption | **wrong** | drawn from `steps` and `gates.after`; ops-flow only as fallback |
| 3 | `flows/[flow]/[skill]` STEP_DEF | a table of ops-flow's six; every other stage "produces nothing, no gate" | **wrong** | from `FlowDoc.stage` in the manifest |
| 4 | `initiatives/[team]/[slug]` WHAT | ops-flow's words for document roles other flows share | **wrong** | only roles true in every flow keep a subtitle |
| 5 | `initiatives` + `teams/[slug]` | gates counted "of 4" | **wrong** | `of {gates.length}` |
| 6 | `skills/:name/scores` | dimensions of every rubric version, merged | **wrong** | the ruler the versions declare |
| 7 | same | two judges averaged into one row | **wrong** | kept apart by judge; newest shown, judge named |
| 8 | 12 × `to_char(…HH24:MI)` | a time with no zone, rendered in UTC | **wrong** | API sends ISO 8601; console renders one named zone |
| 9 | `initiatives` STATE column | an outcome for closed rows, a stage name for open ones | **incoherent** | six values, one question; never a stage name |
| 10 | `zz.doc.updated_at` | every document written at `00:00` | **wrong** | mtime, and 567 rows backfilled |
| 11 | `lib/block-labels.ts` LABELS | four blocks named by hand; a fifth shows its bare id | **class 1** | see below |
| 12 | `blocks`, `activity`, `runs`, `flows`, `/` | a table that can be empty, with no empty state | **blank slab** | see below |
| 13 | `teams/[slug]` | shows position and gates, no state — unlike the initiatives list | **inconsistent** | shared `StateBadge` |
| 14 | 17 pages | `updatedAt={new Date()}` | **defensible** | it is the view's age, not the data's; left, and recorded |
| 15 | `zz-skill-*` descriptions | "Stage 1 of…" in prose, and two of the five had drifted | **wrong** | the position lives in the manifest; taken out of the prose |

## What is deliberately NOT changed

- **`?? '—'` on a missing value.** That is unknown shown as unknown, which is the right
  answer. Class 4 is only about unknown shown as a *confident* value.
- **`STAGES` in `Flow.tsx`.** It is reached only when the catalog cannot resolve an
  initiative's flow, and ops-flow's shape is then the best guess available. It is a fallback,
  not a default.
- **`NEXT_PUBLIC_ZZ_TZ` is baked at image build.** It is configurable in the sense that a
  deployment sets one variable, not in the sense that it can change without a rebuild.

## The durable half: this repository now has a gate

`node scripts/gate.ts`. zz-stack catches this class before it ships because every failure
that reached a person became a check; this repository had `tsc` and nothing else, and the
difference was seven bugs in an afternoon, every one found by the stakeholder. A type checker
cannot see any of them.

Five checks, each one a bug that actually shipped:

| check | the bug it remembers |
|---|---|
| a timestamp is rendered through `<Time>` | a UTC wall-clock with no zone, read eight hours wrong |
| no map is keyed by one flow's, block's or skill's names | eight copies of "every initiative runs ops-flow" |
| no hardcoded denominator | "0 of 4" on a flow with one gate |
| a table that can be empty says so | five pages rendered a blank slab under a header |
| the build passes | |

Adding a check is how a bug stops recurring. That is the whole method.

## One contract change fell out of it

`knowledge.updated` was a bare date while every other `updated` was an instant — one field
name, two shapes, so no rule about rendering a time could be stated, let alone checked. It is
ISO now, like the rest.
