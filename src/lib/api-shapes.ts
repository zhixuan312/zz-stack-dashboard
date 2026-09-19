/**
 * WHAT THE CONSOLE'S API SAYS — every payload shape, and nothing that fetches one.
 *
 * SPLIT FROM api.ts BY SUBJECT when that file reached the repository's 700-line ceiling. The
 * seam was already drawn there in a comment ("the shapes the API returns"), which is the tell
 * that it was two files sharing one name: everything above it is HOW the console talks to the
 * gateway — one fetch, the session the browser holds, the query cache, the mode the reader is
 * in — and everything here is WHAT the gateway answers with.
 *
 * They change for different reasons and at different times. A payload gains a field whenever
 * the gateway learns something new; the transport changes when the way the console
 * authenticates or caches does, which is almost never. Keeping them apart means a routine
 * addition to a shape stops touching the file that holds the auth argument.
 *
 * NO TYPE HERE IS HAND-WRITTEN TWICE. Each is the console's reading of one gateway route's
 * response, and the gateway is the author of the shape — when the two disagree it is this file
 * that is wrong.
 */


export interface Me {
  email: string; name: string; role: 'superadmin' | 'member';
  mayRead: boolean; superadmin: boolean; via: string;
  /** The gateway's own sentence for WHY it will not answer, present only when `mayRead` is
   *  false. This route answers 200 by design, so without it the browser had nothing to show
   *  but a line it wrote itself — and the whole reason `ok()` names its refusals is that a
   *  generic one sends a person to check a password that was already correct. */
  why?: string;
  // A slug alone couldn't say whether the caller is a team admin or a member; the gateway
  // now sends the role alongside each team it already resolved.
  teams: { slug: string; role: 'admin' | 'member' }[]; activeTeam: string | null;
}
/** How far one initiative has got, judged against ITS OWN flow's declared documents.
 *
 * `gated` AND `closed` ARE TWO RUNGS, NOT ONE. This said `complete`, and the gateway has never
 * sent that: clearing every gate is not being done. An initiative can have every gate approved
 * and still be open — work continues, nobody has said what came of it — which is the state most
 * of this platform's finished-looking initiatives are actually in. Closure is an `outcome` on
 * the flow's closing document and nothing else. Rendering `stages.complete` read `undefined` on
 * every response, so that slice drew as nothing and the two real end-stages were invisible. */
type InitiativeStage = 'noflow' | 'notstarted' | 'drafting' | 'agreed' | 'gated' | 'closed';

/**
 * The four the overview leads with — initiative, knowledge, tools, system.
 *
 * FIGURES ONLY. Every word on a tile is a fixed label in the component or a template with
 * these numbers substituted in; the API composes no prose, because the console has to
 * render without a model in the path.
 */
export interface OverviewMetrics {
  progressing: {
    /** Median completeness, 0–100. Null when nothing scoreable was active. */
    value: number | null;
    active: number; scoreable: number;
    /** Every active initiative in exactly one stage — the mark under the tile. */
    stages: Record<InitiativeStage, number>;
    /** Gate documents written and unapproved, across the OPEN initiatives — work that is
     *  finished and sitting on a human. Gates only: a flow's own manifest says which
     *  documents gate, and an ungated document never wanted an approver. */
    waiting: number;
    /** Days the oldest of those has waited. Null when nothing is waiting. */
    waitingOldestDays: number | null;
    /** Why this one carries no delta. The API states it; the browser does not guess. */
    noDeltaBecause: string;
  };
  knowledge: {
    value: number | null; prev: number | null;
    fromWork: number; imported: number; searches: number;
    importThresholdPerHour: number;
  };
  refusals: {
    value: number | null; prev: number | null; refused: number; calls: number;
    /** Which door refused, largest first — `core` / `eval` / `manage`, off `subject`.
     *  Sums exactly to `refused`: same predicate, grouped. NOT `Overview.refusals[]`,
     *  which is a top-12 across every event kind. */
    byDoor: { door: string; n: number }[];
  };
  context: {
    /** KB. */
    value: number | null; prev: number | null; p90: number | null;
    runs: { kb: number; skill: string }[];
    /** Runs whose bytes were never measured — excluded from the figures above, never
     *  folded in as zero. A run nobody measured is not a run that moved nothing. */
    unmeasured: number;
    /** True when the gateway's run query hit its 400-row cap, so the previous-window
     *  comparison is a median over a truncated tail rather than the whole window. */
    capped: boolean;
    /** Rule of thumb at ~4 bytes per token — NOT a measurement. Nothing counts tokens. */
    contextWindowKb: number;
  };
}

export interface Overview {
  metrics: OverviewMetrics;
  counts: { teams: number; activeTeams: number; people: number; superadmins: number;
            documents: number; initiatives: number; events: number; failures: number;
            /** Events belonging to no team, so the per-team rows cannot sum to `events`. */
            unattributedEvents: number };
  /** How wide one bucket is — `hour` for the 24-hour window, `day` otherwise. A day
   *  bucket over a one-day window is a single point, and a trend through one point is
   *  not a trend. */
  grain: 'hour' | 'day' | 'week' | 'month';
  /** `bucket` is an INSTANT (ISO 8601, UTC, with the Z), not a pre-formatted local
   *  string — an hour rendered in the database's timezone is eight hours wrong for the
   *  reader this platform is deployed for. Format it in the browser. */
  /**
   * Tool calls per bucket, split three DISJOINT ways that sum to the total, so the
   * chart can stack them and the column height is a real number of calls.
   *
   * Every bucket in the window is present, including the empty ones — a quiet hour is a
   * zero, not an absent row, and a chart that spaces thirteen rows evenly across a day
   * states a shape the data does not have.
   */
  toolTrend: { bucket: string; inside: number; outside: number; refused: number }[];
  /**
   * The zone the buckets were CUT in — this deployment's own, not the viewer's.
   *
   * Every bucket is still an instant, and the browser still formats it; this says on which
   * calendar, so the label agrees with the bar. Formatting in the viewer's zone instead
   * would label a Singapore day with a laptop's idea of what day it is, and a bar cut at
   * one boundary described by another is wrong in a way nothing on screen would show.
   */
  timezone: string;
  eventKinds: { kind: string; n: number }[];
  /**
   * Refused tool calls on two axes — the same population `metrics.refusals` counts, so
   * the panel's total and the tile's are the same number and not two things wearing one
   * word. WHICH TOOL and WHICH MESSAGE answer different questions: one tool refusing for
   * nine reasons is a surface problem; nine tools refusing with one message is one bug.
   */
  refusals: {
    total: number;
    byTool: { tool: string; n: number }[];
    /** `tools` is how many distinct tools emit this exact message. */
    byMessage: { message: string; tool: string; tools: number; n: number }[];
  };
}
export interface Team {
  slug: string; name: string; status: string; created: string;
  members: number; initiatives: number;
  /** Written documents — sources are counted apart, though both live in one table. */
  documents: number;
  sources: number;
  /** Knowledge nodes on the team's shelf. */
  knowledge: number;
}
export interface TeamDetail {
  team: { slug: string; name: string; status: string; created: string };
  members: { email: string; name: string; role: string; joined: string }[];
}
export interface Gate {
  name: string;
  /** `handover` is the platform's own closing step, appended to every gating flow. It is a
   *  real gate — somebody signs it — but it is written AFTER the close, so any question
   *  about an OPEN initiative has to leave it out, or every one of them reads as owing a
   *  signature on work nobody has finished. */
  role?: string;
  passed: boolean;
  /** Whether the gated document EXISTS yet. `passed: false` alone cannot tell "nobody has
   *  drafted it" from "it is drafted and nobody has signed", and those are opposite
   *  instructions: the first is waiting on the agent, the second on a person. */
  written: boolean;
  after: number;
}
/** One stage of a flow, named by the flow itself. */
/** One node of the diagram, as the API derived it — including the `open` and `closed`
 *  bookends every initiative has and no manifest declares.
 *
 *  `done` every declared document exists and every gate on them is approved;
 *  `partial` they exist but a gate is still open; `empty` none is written;
 *  `untracked` the step declares no document, so nothing could evidence it. */
export interface Step {
  name: string; what: string; produces: string;
  state: 'done' | 'partial' | 'empty' | 'untracked';
  current: boolean;
}

export interface Initiative {
  team: string; slug: string; flow: string | null;
  documents: number; approvals: number; updated: string; stakeholder: string | null;
  /** Position in THIS flow, and how many stages it has. Without `of`, a position is
   *  only meaningful against ops-flow, which is what the console used to assume of every
   *  initiative on the platform. */
  at: number; of: number; stage: string; steps: Step[]; gates: Gate[]; accepted: boolean;
  /** Everything the flow asks for was there at the close. False on one that stopped short. */
  complete: boolean;
  /** Finished, on any of the three outcomes. `accepted` answers a narrower question — whether
   *  a PERSON signed it — and using it for "is this done" left every `delivered` initiative
   *  drawn with its last stage still open. */
  closed: boolean;
  /** One of `accepted` | `delivered` | `abandoned`, or null while it is open. All three mean
   *  CLOSED — close() records exactly one of them. See OUTCOMES in @zz/contracts. */
  outcome: string | null;
}
interface DocRow {
  path: string; type: string; status: string | null; outcome: string | null;
  approved_by: string | null; updated_at: string; bytes: number; title: string | null;
  /**
   * Whether the FLOW gates this document — from its manifest, not a guess.
   *
   * `false` means no approval is coming, so "draft" would be a lie. Null means
   * the flow declares nothing about this file (a source, or another flow's
   * document): "we do not know" is a different answer from "none needed".
   */
  gated?: boolean | null;
  /** The document the initiative's outcome is recorded on. */
  closing?: boolean;
  /** Ungated, but the initiative cannot close without it. */
  requiredForClose?: boolean;
  /** For a source: the document it was attached to. */
  supports?: string | null;
}
export interface InitiativeDetail {
  team: string; slug: string; documents: DocRow[];
  decisions: { path: string; role: string; key: string; verdict: string;
               qualifier: string | null; detail: string | null;
               checker: string | null }[];
  /** WHAT THE LEDGER ACTUALLY HOLDS, so a column of blanks reads as a fact about the
   *  documents rather than as a derivation that has stopped running. The production case is
   *  374 `agreement` rows and 104 `plan` rows, none of them a fit claim — with nothing on
   *  screen saying so, the reader cannot tell that from a broken extractor. */
  decisionCounts: { rows: number; withVerdict: number; withQualifier: number; withChecker: number };
  at: number; of: number; stage: string; steps: Step[]; gates: Gate[]; accepted: boolean;
  /** Everything the flow asks for was there at the close. False on one that stopped short. */
  complete: boolean;
  closed: boolean;
  outcome: string | null;
}
export interface DocumentDetail {
  team: string; initiative: string; path: string; flow: string | null;
  type: string; status: string | null; outcome: string | null;
  approved_by: string | null; approved_at: string | null; closed_by: string | null;
  title: string | null; tags: string[] | null; evidence: string[] | null;
  superseded_by: string | null; body: string | null;
  updated_at: string; bytes: number;
  /** The flow's rule for this document — see `DocRow.gated`. Null means the
   *  flow declares nothing about it, which is not the same as "none needed". */
  gated?: boolean | null;
  closing?: boolean;
  requiredForClose?: boolean;
  /** Keyed by this document's path — a ledger is what THIS document claims. */
  decisions: { key: string; role: string; verdict: string; qualifier: string | null;
               detail: string | null; checker: string | null }[];
  /** WHAT THE LEDGER ACTUALLY HOLDS, so a column of blanks reads as a fact about the
   *  document rather than as a derivation that has stopped running. */
  decisionCounts: { rows: number; withVerdict: number; withQualifier: number; withChecker: number };
  /** Every version of this document, oldest first: the frozen snapshots and the live one. */
  versions: { path: string; body: string | null; status: string | null;
              approved_by: string | null; updated_at: string; bytes: number; version: number }[];
  /** The supporting information attached to this document — why it changed. */
  sources: { path: string; title: string | null; body: string | null;
             supports: string; added: string; bytes: number }[];
}
/* SkillScores WAS HERE, for `/skills/:name/scores`, and both went with their subject.
 * An evaluation is about a plugin version now; a score keyed on a skill is one nothing can
 * write. The gateway route is deleted, so a type describing its response would be a shape
 * with no sender. */
export interface KnowledgeNode {
  /** Unique across teams: `<team>/<path>`. The NUMBER is not — every team numbers
   *  its own nodes from 0001, so two teams both have a node 1. */
  key: string;
  num: string;
  team: string; path: string; type: string; status: string;
  title: string; tags: string[] | null; updated: string; bytes: number; excerpt: string;
  /** The initiative this lesson came out of — the only linkage the store records. */
  evidence: string[] | null;
  superseded_by: string | null;
}
/** One entry in the knowledge base's own log — `/knowledge/log`.
 *
 *  `kind` is `knowledge.add` or `knowledge.supersede`, the events zz-core writes beside its
 *  `_knowledge/log.md`. `recordedTitle` is the title AS TYPED at the time; `nodeTitle` is the
 *  node's title as it stands now, or null when the node is no longer on the shelf — an entry
 *  outliving its node is a real thing that happened, not a row to drop. */
export interface KnowledgeLogEntry {
  ts: string; actor: string; team: string | null;
  kind: 'knowledge.add' | 'knowledge.supersede';
  node: string;
  recorded_title: string | null;
  superseded_by: string | null;
  node_title: string | null;
  node_status: string | null;
}
export interface KnowledgeBody {
  team: string; path: string; type: string; status: string; title: string;
  tags: string[] | null; updated: string; body: string;
  evidence: string[] | null; superseded_by: string | null;
  /** Each piece of evidence WITH THE TEAM ITS INITIATIVE LIVES IN, resolved by the gateway.
   *
   *  `knowledge_add` accepts evidence naming an initiative in any team the author belongs to,
   *  and a platform-shelf node cites tenant initiatives by design — so linking evidence under
   *  the NODE's team produced `/initiatives/zz-platform/<slug>`, which answers "not found".
   *  `team` is null when nothing on this deployment has an initiative by that name, and the
   *  name is then text rather than a link. */
  evidence_in: { name: string; team: string | null }[] | null;
}
/** One line of `POST /api/console/ask`'s answer, built by the gateway from the retrieved
 *  document(s) it actually named — never from the model's own text (see console-ask.ts).
 *  `path` is a raw store path (`<initiative>/<path>`), not a URL — `citationHref` (`@/lib/
 *  citations`) turns it into one — and is `null` when the cited document is real but not
 *  one this team's console can open (the platform's own shared knowledge shelf). */
interface AskCitation { path: string | null; title: string }
export interface AskAnswer { answer: string; citations: AskCitation[] }
export interface Skill {
  name: string; version: string; kind: string; flow: string | null;
  /** Still served, or kept only because it owns these runs. */
  retired: boolean;
  /* NO `teams`. /skills is a teamless route — a skill is a platform-wide capability — and
   * it also returned the slugs of every team that had run one, which is not a fact about the
   * skill but a list of the other tenants on the deployment. Nothing here ever read it. */
  runs: number; calls: number; callsAvg: number; callsMax: number; refusals: number;
  /** Runs a duration could be computed for — those with more than one call. See below. */
  timedRuns: number;
  /* NO `turns`. zz.run.turns was written by nothing and no turn event was ever emitted, so
   * any figure built on it was a zero wearing the clothes of a measurement. */
  /* NULLABLE, all five, because the gateway sends null and always did — these were typed
   * `number` and the pages read them straight, so `Math.round(null)` printed a skill nobody
   * has measured as "0 KB" and `dur(null)` printed it as an em dash that meant something
   * else. Seconds; null when no run of this skill has a span to measure (a single-call run
   * has one timestamp, so `ended_at = started_at` by construction — 148 of 336 runs on this
   * deployment). `durationTotal` is the sum of those spans, not of every run's. */
  durationAvg: number | null; durationMedian: number | null; durationMax: number | null;
  durationTotal: number | null;
  kbPerRun: number | null; mbTotal: number | null;
  logged: { calls: number; failed: number; tools: number } | null;
}
export interface SkillDetail {
  skill: string;
  /* `dimensions`, `findings` and `evaluated` WERE HERE and went with their subject. An
   * evaluation's subject is a plugin VERSION now, so nothing can write a per-skill score
   * again — `GET /skills/:name` sends `{ skill, surfaces, busiestTools }` and says so in its
   * own comment. The reads outlived the fields: `detail.dimensions.filter(...)` and
   * `usePaged(d.findings)` both dereferenced undefined, and every skill with a recorded run
   * threw on the route error boundary rather than rendering. */
  surfaces: { surface: string; calls: number; failed: number; tools: number }[];
  busiestTools: { tool: string; calls: number; failed: number }[];
}
export interface Runs {
  /** `mb` is SQL-null for a window with no run, or none measured — never a confident 0. */
  totals: { runs: number; calls: number; refusals: number; mb: number | null };
  /* `outcomes` and `gaps.runsWithoutOutcome` WERE HERE and went with the column. zz.run.outcome
   * was written by one deleted op and read by nothing; migration 048 drops it. A breakdown of a
   * column nothing writes is one bar reading "not recorded" forever, and a gap that can never
   * close is a feature nobody built, reported as a defect. */
  gaps: { turnsAttributed: boolean; turnEvents: number };
}
/** A skill a plugin ships. `theirs` = a block team's own, vendored, and carrying a
 *  `source:` line that says so; `ours` = everything we wrote — a plugin's own stages,
 *  the platform's, and what we worked out by calling somebody else's server. */
interface PluginSkill {
  name: string;
  /** Where the plugin's method puts it, when it declares stages. Null for a skill that is
   *  simply shipped — a standalone, a reference, a note about a block. The old flow page
   *  could only list stages, so ten of sdlc's seventeen skills had no page at all. */
  position: number | null;
  isEntry: boolean;
  origin: 'theirs' | 'ours';
  version: string | null; description: string | null; source: string | null;
  versions: number; calls: number; evals: number;
  everRun: boolean; lastRun: string | null;
}

/**
 * A PLUGIN — `/plugins`. What a person installs: a package's skills plus the MCP servers
 * those skills call, under one declared version.
 *
 * Catalog-first, so a plugin nobody has run yet still appears with its skills marked
 * never-run. Three kinds of thing arrive in this one shape: a catalog package, `zz` (the
 * platform itself, which every account carries and which ships no flow.json), and a
 * registered block, whose single server is itself.
 */
export interface PluginRow {
  plugin: string;
  /** The catalog owner directory. Null for `zz` and for a registered block. */
  owner: string | null;
  /** Ours, or somebody else's — it decides what an evaluation DOES with its findings. */
  origin: 'platform' | 'third_party';
  agentName: string | null;
  description: string | null;
  /** From zz.block, and only for a registered block: empty until somebody describes it,
   *  and the console shows the id then. Null for anything catalog-resident. */
  title: string | null; kind: string | null;
  /** What the plugin DECLARES. A number a person cites — and therefore a claim, which is
   *  what `release.digest` is for. Null for a block, which declares none. */
  version: string | null;
  /** Every MCP server this plugin's skills reach. From the manifest for a catalog package;
   *  for a block, the block itself. */
  servers: string[];
  /** The method's running order, when it declares one. Empty for a package that is a
   *  toolbox rather than a method. */
  stages: string[];
  entry: string | null;
  documents: { name: string; role: string | null; gate: boolean; stage: string | null }[];
  gates: number;
  skills: PluginSkill[];
  calls: number; failed: number;
  /** The most recent call across every skill, or null when nothing has ever run it.
   *  The list sorts on this. */
  lastRun: string | null;
  /** What was RELEASED at the declared version, from zz.plugin_version — the digest is what
   *  makes the version true. Null when nothing has vouched for that number: a plugin edited
   *  past its last release, a block that ships through no marketplace, or simply a platform
   *  where release has not yet begun recording. Never an error. */
  release: { version: string; digest: string; evals: number } | null;
  /** THE LAST ROUND THAT REACHED A VERDICT, and the report behind it.
   *
   *  `effectiveness` is 0-10 and `headroomPoints` is its distance from 10 — two independent
   *  axes, not one scale: a plugin can score 9 and still have something named to fix, and one
   *  scoring 5 with nothing named is a worse situation than a 5 with three changes waiting.
   *
   *  EVERY FIGURE BELOW IS NULLABLE SEPARATELY. Rounds taken before the platform stored the
   *  axes carry a `recommendation` and nothing else, and there is no backfill: inferring which
   *  initiative produced a round from its plugin name and a date window is the guess that
   *  produced five attribution defects in one day. An older round reads as a verdict with no
   *  score and no link, which is exactly what it is. */
  latestEval: {
    /** The version that was MEASURED, which is not necessarily the one on the shelf today. */
    version: string;
    effectiveness: number | null;
    /** The score's own word: working well / working / working poorly / not working, or
     *  `not measurable` when the round produced no score. Named by the gateway from the
     *  score through one shared rule — never stored, because a caption computed from a
     *  column in the same row goes stale the moment the vocabulary moves. */
    band: string;
    headroomPoints: number | null;
    headroomNamed: number | null;
    /** THE SECOND AXIS, and it replaced a recommendation. One of `no change needed`,
     *  `change identified`, `unexplained gap`, `not measured`.
     *
     *  The old vocabulary — keep / keep-and-change / re-run / not-evaluable / retire — asked
     *  what to DO about a plugin somebody installed on purpose and is going to keep, which is
     *  a question with one permanent answer. This reports what the evidence says about the gap
     *  and prescribes nothing: whether a change CAN be made is not something a score
     *  establishes. */
    headroomState: string;
    /** Both halves of zz.doc's key, or null. A slug without its team cannot be addressed. */
    initiative: { team: string; slug: string } | null;
    at: string;
  } | null;
}

/** A skill, read — `/plugins/:plugin/skills/:skill`. The same shape whatever ships it. */
export interface SkillText {
  skill: string;
  /** Which plugin it came from. */
  plugin: string;
  /** True when this is the plugin's front door rather than one of its stages. */
  isEntry?: boolean;
  /** `theirs` only where another team wrote it; everything we ship is ours. */
  origin: 'theirs' | 'ours';
  version: string | null; description: string | null; source: string | null;
  whenToUse: string | null;
  /** The SKILL.md with its frontmatter removed. */
  body: string;
  /** Everything shipped beside it — `references/…`, and `scripts/…` where one exists. */
  references: { path: string; content: string }[];
}
export interface ActivityEvent {
  ts: string; actor: string | null; team: string | null; kind: string;
  subject: string | null; initiative: string | null; step: string | null;
  ok: boolean | null; refusal: string | null;
}
/** The team out of a `<slug> (<role>)` entry — see Person.teams. */
export function teamSlug(entry: string): string {
  return entry.replace(/\s*\(.*\)\s*$/, '').trim();
}
export interface Person {
  email: string; name: string; role: string; status: string; created: string;
  /** Each entry is `<slug> (<role>)`, not a bare slug — the gateway formats it for display.
   *  Counting distinct entries therefore counts MEMBERSHIPS: a team with one admin and one
   *  member contributes two. `teamSlug()` is how to get the team out of one. */
  activeTeam: string | null; teams: string[]; tokens: number; last_used: string | null;
}

/* ── /settings/me/* (Task I-13) ───────────────────────────────────────────── */
export interface MyAccessToken {
  id: string; label: string; scope: string;
  created_at: string; last_used_at: string | null; revoked_at: string | null;
}
/** The one plaintext exception in this whole surface — see settings.ts's own header
 *  (gateway) and `TokensPanel`'s comment for why this shape is never redacted and never
 *  requested again after the moment it is issued. */
export interface IssuedToken { token: string; label: string; email: string }
export interface MyClientSetup { client: string; config: string }
export interface MyTeams {
  actingFor: string; teams: { team: string; role: string; active: boolean }[]; note: string | null;
}

/* ── /settings/team/* (Task I-14) ─────────────────────────────────────────── */

/** A row from `GET /settings/team/members` — the roster of one team, for a caller who
 *  administers it (see `settings.ts`'s own gate: `teamAuthority`, not `resolveScope`). */
export interface TeamMemberRow { email: string; role: 'admin' | 'member' }

/* ── /settings/platform/* (Task I-15) ─────────────────────────────────────── */

/** A row from `GET /settings/platform/people` — every principal, superadmin only. Not
 *  `Person` (above): that shape is `/people`'s own analytics read, which is scoped
 *  differently and carries token/connection counts this surface has no use for. */
export interface PlatformPersonRow {
  email: string; display_name: string; role: 'superadmin' | 'member'; status: string; created_at: string;
  teams: { team: string; role: 'admin' | 'member'; added_by: string | null; added_at: string }[];
}
