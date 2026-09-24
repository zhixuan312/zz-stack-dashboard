/**
 * What the console's API says — every payload shape, and nothing that fetches one.
 * api.ts holds the transport: one fetch, the session, the query cache.
 *
 * Each type here is the console's reading of one gateway route's response, and the gateway
 * is the author of the shape — when the two disagree it is this file that is wrong.
 */


export interface Me {
  email: string; name: string; role: 'superadmin' | 'member';
  mayRead: boolean; superadmin: boolean; via: string;
  /** The gateway's own sentence for why it will not answer, present only when `mayRead` is
   *  false. DELIBERATE: this route answers 200 either way, so the refusal travels in the
   *  body. */
  why?: string;
  teams: { slug: string; role: 'admin' | 'member' }[]; activeTeam: string | null;
}
/** How far one initiative has got, judged against its own flow's declared documents.
 *
 * `gated` and `closed` are two rungs: an initiative can have every gate approved and still be
 * open. Closure is an `outcome` on the flow's closing document and nothing else. */
type InitiativeStage = 'noflow' | 'notstarted' | 'drafting' | 'agreed' | 'gated' | 'closed';

/**
 * The four the overview leads with — initiative, knowledge, tools, system.
 *
 * Figures only: every word on a tile is a fixed label in the component or a template with
 * these numbers substituted in. The API composes no prose.
 */
export interface OverviewMetrics {
  progressing: {
    /** Median completeness, 0–100. Null when nothing scoreable was active. */
    value: number | null;
    active: number; scoreable: number;
    /** Every active initiative in exactly one stage — the mark under the tile. */
    stages: Record<InitiativeStage, number>;
    /** Gate documents written and unapproved, across the open initiatives — work sitting on
     *  a human. Gates only: a flow's own manifest says which documents gate. */
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
     *  Sums exactly to `refused`: same predicate, grouped. Not `Overview.refusals[]`,
     *  which is a top-12 across every event kind. */
    byDoor: { door: string; n: number }[];
  };
  context: {
    /** KB. */
    value: number | null; prev: number | null; p90: number | null;
    runs: { kb: number; skill: string }[];
    /** Runs whose bytes were never measured — excluded from the figures above, never
     *  folded in as zero. */
    unmeasured: number;
    /** True when the gateway's run query hit its 400-row cap, so the previous-window
     *  comparison is a median over a truncated tail rather than the whole window. */
    capped: boolean;
    /** Rule of thumb at ~4 bytes per token, not a measurement. Nothing counts tokens. */
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
  /**
   * Tool calls per bucket, split three disjoint ways that sum to the total, so the chart
   * can stack them and the column height is a real number of calls.
   *
   * `bucket` is an instant (ISO 8601, UTC, with the Z), not a pre-formatted local string;
   * the browser formats it. Every bucket in the window is present, including empty ones —
   * a quiet hour is a zero, not an absent row.
   */
  toolTrend: { bucket: string; inside: number; outside: number; refused: number }[];
  /**
   * The zone the buckets were cut in — this deployment's own, not the viewer's. Format the
   * labels on this calendar, so the label agrees with the bar it sits under.
   */
  timezone: string;
  eventKinds: { kind: string; n: number }[];
  /**
   * Refused tool calls on two axes — the same population `metrics.refusals` counts, so the
   * panel's total and the tile's are the same number. Which tool and which message answer
   * different questions: one tool refusing for nine reasons is a surface problem; nine tools
   * refusing with one message is one bug.
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
  /** `handover` is the platform's own closing step, appended to every gating flow. It gates,
   *  but it is written after the close, so any question about an open initiative leaves it
   *  out. */
  role?: string;
  passed: boolean;
  /** Whether the gated document exists yet. `passed: false` alone cannot tell "nobody has
   *  drafted it" from "it is drafted and nobody has signed" — the first waits on the agent,
   *  the second on a person. */
  written: boolean;
  after: number;
}
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
  /** Position in this flow, and how many stages it has. A position without `of` means
   *  nothing, because flows differ in length. */
  at: number; of: number; stage: string; steps: Step[]; gates: Gate[]; accepted: boolean;
  /** Everything the flow asks for was there at the close. False on one that stopped short. */
  complete: boolean;
  /** Finished, on any of the three outcomes. `accepted` answers the narrower question of
   *  whether a person signed it. */
  closed: boolean;
  /** One of `accepted` | `delivered` | `abandoned`, or null while it is open. All three mean
   *  closed — close() records exactly one. See OUTCOMES in @zz/contracts. */
  outcome: string | null;
}
interface DocRow {
  path: string; type: string; status: string | null; outcome: string | null;
  approved_by: string | null; updated_at: string; bytes: number; title: string | null;
  /**
   * Whether the flow gates this document, from its manifest. `false` means no approval is
   * coming, so "draft" would be wrong. Null means the flow declares nothing about this file
   * (a source, or another flow's document), which is not the same as "none needed".
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
  /** What the ledger actually holds, so a column of blanks reads as a fact about the
   *  documents rather than as a derivation that has stopped running. */
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
  /** Keyed by this document's path — a ledger is what this document claims. */
  decisions: { key: string; role: string; verdict: string; qualifier: string | null;
               detail: string | null; checker: string | null }[];
  /** What the ledger actually holds, so a column of blanks reads as a fact about the
   *  document rather than as a derivation that has stopped running. */
  decisionCounts: { rows: number; withVerdict: number; withQualifier: number; withChecker: number };
  /** Every version of this document, oldest first: the frozen snapshots and the live one. */
  versions: { path: string; body: string | null; status: string | null;
              approved_by: string | null; updated_at: string; bytes: number; version: number }[];
  /** The supporting information attached to this document — why it changed. */
  sources: { path: string; title: string | null; body: string | null;
             supports: string; added: string; bytes: number }[];
}
export interface KnowledgeNode {
  /** Unique across teams: `<team>/<path>`. The number is not — every team numbers
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
 *  `_knowledge/log.md`. `recorded_title` is the title as typed at the time; `node_title` is the
 *  node's title as it stands now, or null when the node is no longer on the shelf. */
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
  /** Each piece of evidence with the team its initiative lives in, resolved by the gateway —
   *  not the node's own team, since a node may cite an initiative in another. `team` is null
   *  when nothing on this deployment has an initiative by that name, and the name is then
   *  text rather than a link. */
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
  /* No `teams`: /skills is a teamless route, because a skill is a platform-wide capability. */
  runs: number; calls: number; callsAvg: number; callsMax: number; refusals: number;
  /** Runs a duration could be computed for — those with more than one call. */
  timedRuns: number;
  /* Nullable, all five, and the reader must handle null rather than round it to 0. Seconds;
   * null when no run of this skill has a span to measure, a single-call run having one
   * timestamp. `durationTotal` sums those spans, not every run's. */
  durationAvg: number | null; durationMedian: number | null; durationMax: number | null;
  durationTotal: number | null;
  kbPerRun: number | null; mbTotal: number | null;
  logged: { calls: number; failed: number; tools: number } | null;
}
export interface SkillDetail {
  skill: string;
  /* No per-skill scores: an evaluation's subject is a plugin version. `GET /skills/:name`
   * sends exactly `{ skill, surfaces, busiestTools }`. */
  surfaces: { surface: string; calls: number; failed: number; tools: number }[];
  busiestTools: { tool: string; calls: number; failed: number }[];
}
export interface Runs {
  /** `mb` is SQL-null for a window with no run, or none measured — never a confident 0. */
  totals: { runs: number; calls: number; refusals: number; mb: number | null };
}
/** A skill a plugin ships. `theirs` = vendored from somebody else, carrying a `source:` line
 *  that says so; `ours` = everything we wrote — a plugin's own stages, the platform's, and what
 *  we worked out by calling somebody else's server. */
interface PluginSkill {
  name: string;
  /** Where the plugin's method puts it, when it declares stages. Null for a skill that is
   *  simply shipped — a standalone, a reference, a note. */
  position: number | null;
  isEntry: boolean;
  origin: 'theirs' | 'ours';
  version: string | null; description: string | null; source: string | null;
  versions: number; calls: number; evals: number;
  everRun: boolean; lastRun: string | null;
}

/**
 * A plugin — `/plugins`. What a person installs: a package's skills plus the MCP servers
 * those skills call, under one declared version.
 *
 * Catalog-first, so a plugin nobody has run yet still appears with its skills marked
 * never-run. Two kinds of thing arrive in this one shape: a catalog package and `zz-core` (the
 * platform itself, read from the platform's own skills rather than a catalog entry).
 */
export interface PluginRow {
  plugin: string;
  /** The catalog owner directory. Null for `zz-core`. */
  owner: string | null;
  agentName: string | null;
  description: string | null;
  /** What the plugin declares — a claim, which is what `release.digest` checks. Null when it
   *  declares none. */
  version: string | null;
  /** Every MCP server this plugin's skills reach, from its manifest. */
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
  /** What was released at the declared version, from zz.plugin_version — the digest is what
   *  makes the version true. Null when nothing has vouched for that number, which is not an
   *  error. */
  release: { version: string; digest: string; evals: number } | null;
  /** The last round that reached a verdict, and the report behind it.
   *
   *  `effectiveness` is 0-10 and `headroomPoints` is its distance from 10 — two independent
   *  axes, not one scale: a plugin can score 9 and still have something named to fix.
   *
   *  Every figure below is nullable separately, and a round that carries no score reads as a
   *  verdict with no score and no link. */
  latestEval: {
    /** The version that was measured, which is not necessarily the one on the shelf today. */
    version: string;
    effectiveness: number | null;
    /** The score's own word: working well / working / working poorly / not working, or
     *  `not measurable` when the round produced no score. Derived by the gateway from the
     *  score through one shared rule, never stored. */
    band: string;
    headroomPoints: number | null;
    headroomNamed: number | null;
    /** The second axis: one of `no change needed`, `change identified`, `unexplained gap`,
     *  `not measured`. It reports what the evidence says about the gap and prescribes
     *  nothing. */
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
   *  Counting distinct entries therefore counts memberships, not teams. `teamSlug()` gets
   *  the team out of one. */
  activeTeam: string | null; teams: string[]; tokens: number; last_used: string | null;
}

/* /settings/me/* */
export interface MyAccessToken {
  id: string; label: string;
  created_at: string; last_used_at: string | null; revoked_at: string | null;
}
/** The one plaintext token on this surface: shown once at issue and never fetched again.
 *  COUPLED: the gateway's settings.ts and `TokensPanel`. */
export interface IssuedToken { token: string; label: string; email: string }
export interface MyClientSetup { client: string; config: string }
export interface MyTeams {
  actingFor: string; teams: { team: string; role: string; active: boolean }[]; note: string | null;
}

/* /settings/team/* */

/** A row from `GET /settings/team/members` — the roster of one team, for a caller who
 *  administers it (see `settings.ts`'s own gate: `teamAuthority`, not `resolveScope`). */
export interface TeamMemberRow { email: string; role: 'admin' | 'member' }

/* /settings/platform/* */

/** A row from `GET /settings/platform/people` — every principal, superadmin only. Not
 *  `Person` above, which is `/people`'s analytics read and scoped differently. */
export interface PlatformPersonRow {
  email: string; display_name: string; role: 'superadmin' | 'member'; status: string; created_at: string;
  teams: { team: string; role: 'admin' | 'member'; added_by: string | null; added_at: string }[];
}
