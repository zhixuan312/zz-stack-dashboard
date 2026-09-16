'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createContext, createElement, useContext, useState, type ReactNode } from 'react';

/**
 * Every read the console does.
 *
 * FROM THE BROWSER, NEVER FROM THIS APP'S SERVER — and that is the whole design.
 * The session cookie belongs to the person sitting at the browser. If a Next
 * server component fetched the API instead, it would have to take that cookie
 * out of the incoming request and replay it upstream, which is precisely the
 * "a proxy forwards the caller's credentials" shape the platform forbids and
 * has a check for. Fetching from the client means this app never holds anybody's
 * credential at all: the browser has a cookie, it sends it to the origin that
 * issued it, and this app is a renderer.
 *
 * WHICH IS WHY THE PATH IS RELATIVE. `/api/console/...` resolves against
 * whatever host the page was served from, and Caddy routes that path on the
 * console host to the gateway. No base URL, no CORS, no preflight, and nothing
 * to misconfigure between environments — the page and its API are one origin by
 * construction. In local development there is no gateway behind that path and
 * every call fails honestly with a connection error, which is the correct
 * outcome: the console has no offline mode and pretending otherwise would mean
 * shipping fixtures that drift from the real shape.
 */
const BASE = '/api/console';

export class ApiError extends Error {
  // Declared and assigned rather than a `readonly status` parameter property: those are the
  // one class member TypeScript cannot erase, and this repository is compiled by erasure.
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export async function consoleFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    // The cookie is HttpOnly and same-origin; this says "send it".
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  });
  if (!res.ok) {
    // The gateway names its refusals — "the console needs a browser sign-in —
    // x@y authenticated by pat" — and that sentence is the whole diagnosis.
    // Swallowing it for a generic "request failed" is how somebody spends an
    // afternoon on a problem the server already explained.
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, body?.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/**
 * The superadmin's platform/team choice — see `ConsoleModeProvider`.
 *
 * Client state only, by design (AC-1): no cookie, no server round trip to set
 * it. The gateway decides scope for real on every request per FR-3, so this
 * value only ever changes which parameter `useConsole` attaches; it is never
 * itself an authorization check.
 */
export type ConsoleMode = 'platform' | 'team';

interface ConsoleModeState {
  mode: ConsoleMode;
  setMode: (mode: ConsoleMode) => void;
}

const ConsoleModeContext = createContext<ConsoleModeState | null>(null);

const MODE_STORAGE_KEY = 'zz-console-mode';

function readStoredMode(): ConsoleMode | null {
  try {
    const v = window.localStorage.getItem(MODE_STORAGE_KEY);
    return v === 'platform' || v === 'team' ? v : null;
  } catch {
    // Some browsers throw on ANY localStorage access — private browsing,
    // storage disabled by policy — not just on a missing key. Losing the
    // remembered choice is fine; failing every page load because of it is not.
    return null;
  }
}

function writeStoredMode(mode: ConsoleMode) {
  try {
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // See readStoredMode — persistence is a nicety, not a requirement.
  }
}

/**
 * Mounted once in `Providers`, above every page, so the platform/team choice
 * survives navigation without a cookie or a server round trip.
 *
 * The default depends on who is signed in — platform for a superadmin (the
 * console has always shown the fleet, and it is their job), team otherwise —
 * which this provider cannot know until `/me` resolves. It fetches `/me`
 * itself for exactly that, using the SAME query key `useConsole('/me')` uses
 * everywhere else (see the `scoped` guard below), so this is a shared cache
 * hit, not a second request. Once a choice is explicit — restored from
 * localStorage, or made by hand through `ModeSwitch` — it wins over the
 * me-derived default forever.
 */
export function ConsoleModeProvider({ children }: { children: ReactNode }) {
  const [explicitMode, setExplicitMode] = useState<ConsoleMode | null>(readStoredMode);
  // Not `useConsole('/me')`: that hook reads THIS context to build its query,
  // and this component is still in the middle of producing it — calling it
  // here would read the context from whatever is above this provider (nothing,
  // in practice), not the value this render is about to supply. A plain
  // `useQuery` keyed identically sidesteps the self-reference and still shares
  // the one cached `/me` result with every other caller.
  const me = useQuery<Me, ApiError>({
    queryKey: ['console', '/me'],
    queryFn: () => consoleFetch<Me>('/me'),
    retry: false,
    staleTime: 30_000,
  });

  // A STORED `platform` IS ONLY HONOURED FOR A SUPERADMIN. localStorage is per
  // browser, not per account: a superadmin who signs out of a shared machine
  // leaves `platform` behind, and the member who signs in next would get the
  // platform rail — every flow, block, run and activity link in their face.
  // The gateway would still refuse them the data (`resolveScope` only grants
  // `scope=platform` to `isSuper`), so this was never a disclosure; it was the
  // console lying to somebody about what is theirs, which is its own problem.
  // Discarding the stored value rather than rewriting it keeps the superadmin's
  // own choice intact for when they sign back in.
  const honoured = explicitMode === 'platform' && me.data && !me.data.superadmin
    ? null
    : explicitMode;

  // Nobody has chosen yet: fall back to platform for a superadmin (today's
  // behaviour, and it's their job) or team for everyone else, once `/me` says
  // which — and to platform while it's still loading, the same guess the app
  // always made before this switch existed. This is derived at render time,
  // not synced through an effect, so there is never a render where `mode`
  // disagrees with the `me` data that determines it.
  const mode: ConsoleMode = honoured
    ?? (me.data ? (me.data.superadmin ? 'platform' : 'team') : 'platform');

  function setMode(next: ConsoleMode) {
    setExplicitMode(next);
    writeStoredMode(next);
  }

  // `createElement`, not JSX: this module is `.ts`, not `.tsx`, and staying that
  // way matters — several other agents in this session hold `src/lib/api.ts`
  // as a stable path; renaming it risks a second file resolving ahead of this
  // one and silently reverting every change here.
  return createElement(ConsoleModeContext.Provider, { value: { mode, setMode } }, children);
}

const DEFAULT_MODE_STATE: ConsoleModeState = { mode: 'platform', setMode: () => {} };

/**
 * Reads the platform/team choice. Every real page is inside `ConsoleModeProvider`
 * via the root `Providers`, so the fallback below never runs in the app — it
 * exists so `ModeSwitch` (and anything else that reads this) can still render,
 * inertly, in a test or story that mounts it on its own.
 */
export function useConsoleMode(): ConsoleModeState {
  return useContext(ConsoleModeContext) ?? DEFAULT_MODE_STATE;
}

/**
 * Appends `scope=platform` for platform mode, respecting a path that already
 * has its own query string (`/activity?period=90d`) versus one that doesn't
 * (`/overview`). Team mode adds nothing — per FR-3 that is "no opinion", not
 * "team", and the caller's `activeTeam` on the server applies.
 */
function withScope(path: string, mode: ConsoleMode): string {
  if (mode !== 'platform') return path;
  return path.includes('?') ? `${path}&scope=platform` : `${path}?scope=platform`;
}

/**
 * One hook for every page.
 *
 * `retry: false` because the two failures that matter here — 401 (not signed
 * in) and 403 (signed in, wrong door) — are answers, not outages. Retrying them
 * three times delays the sign-in screen by a couple of seconds and tells the
 * person nothing.
 *
 * THE MODE IS PART OF THE QUERY KEY. Without it, switching from team to
 * platform mode would serve rows TanStack Query already cached for the other
 * scope — the page would look unchanged, or worse show one scope's data under
 * the other's label. `/me` is the one exception: it answers "who is this",
 * not "which team's data", so it carries neither the parameter nor the mode
 * segment — see `ConsoleModeProvider`, which depends on that to avoid
 * refetching `/me` (and re-opening `ConsoleGate`'s spinner) the moment its
 * own default computation changes the mode out from under it.
 */
export function useConsole<T>(path: string | null): UseQueryResult<T, ApiError> {
  const { mode } = useConsoleMode();
  const scoped = path !== null && path !== '/me';
  const url = scoped ? withScope(path as string, mode) : path;
  return useQuery<T, ApiError>({
    queryKey: scoped ? ['console', path, mode] : ['console', path],
    queryFn: () => consoleFetch<T>(url as string),
    enabled: path !== null,
    retry: false,
    staleTime: 30_000,
  });
}

/* ── the shapes the API returns ───────────────────────────────────────────── */

export interface Me {
  email: string; name: string; role: 'superadmin' | 'member';
  mayRead: boolean; superadmin: boolean; via: string;
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
  eventKinds: { kind: string; n: number; failed: number }[];
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
  members: number; initiatives: number; documents: number;
  flows: string[];
  /** Every event attributed to the team, admin actions included. */
  events: number;
  /** Events that name one of the team's OWN initiatives — its work, not its setup. */
  workEvents: number;
  /**
   * Whether the team's documents were produced through the platform.
   *
   * `false` means it holds documents but produced none of them here, so its event
   * count measures admin actions and nothing else. Null when it has no documents
   * at all — there is nothing to have instrumented.
   */
  instrumented: boolean | null;
}
export interface TeamDetail {
  team: { slug: string; name: string; status: string; created: string };
  members: { email: string; name: string; role: string; joined: string }[];
  flows: { flow: string; version: string; agent: string; installed: string }[];
}
export interface Gate { name: string; passed: boolean; after: number }
/** One stage of a flow, named by the flow itself. */
export interface Step { name: string; what: string; produces: string }

export interface Initiative {
  team: string; slug: string; flow: string | null;
  documents: number; approvals: number; updated: string; stakeholder: string | null;
  /** Position in THIS flow, and how many stages it has. Without `of`, a position is
   *  only meaningful against ops-flow, which is what the console used to assume of every
   *  initiative on the platform. */
  at: number; of: number; stage: string; steps: Step[]; gates: Gate[]; accepted: boolean;
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
  at: number; of: number; stage: string; steps: Step[]; gates: Gate[]; accepted: boolean;
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
  /** Teams whose initiatives drove it. Empty when every run of it was teamless. */
  teams: string[];
  runs: number; calls: number; callsAvg: number; callsMax: number; refusals: number;
  /** Runs a duration could be computed for — those with more than one call. See below. */
  timedRuns: number;
  turns: number | null;
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
  evaluated: { evalId: string; judge: string; documents: number; ran: string;
               mean: number | null; control: number | null; controlN: number } | null;
}
export interface SkillDetail {
  skill: string;
  dimensions: { name: string; ordinal: number; fiveMeans: string; oneMeans: string;
                n: number; mean: number | null; sd: number | null; low: number; high: number }[];
  findings: { pattern: string; docs_affected: number; scope: string;
              decision: string | null; proposed_change: string | null }[];
  surfaces: { surface: string; calls: number; failed: number; tools: number }[];
  busiestTools: { tool: string; calls: number; failed: number }[];
}
export interface Runs {
  totals: { runs: number; calls: number; refusals: number; mb: number };
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
  release: { version: string; digest: string; casesDigest: string | null; evals: number } | null;
  /** The most recent ablation run — `claude plugin eval`, which answers the one question a
   *  score cannot: does installing this help, versus not installing it. `meanDelta` is null
   *  when the recorded result carried no readable delta; zz-core owns the authoritative
   *  parse. Null throughout when nothing has been recorded. */
  eval: { ranAt: string; casesDigest: string | null; cases: number; meanDelta: number | null } | null;
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
export interface Person {
  email: string; name: string; role: string; status: string; created: string;
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
/** A row from `GET /settings/team/flows` — what one team has installed, in the same
 *  shape `TeamDetail.flows` uses minus `installed`, which this surface has no use for. */
export interface TeamFlowRow { flow: string; version: string; agent: string }

/* ── /settings/platform/* (Task I-15) ─────────────────────────────────────── */

/** A row from `GET /settings/platform/people` — every principal, superadmin only. Not
 *  `Person` (above): that shape is `/people`'s own analytics read, which is scoped
 *  differently and carries token/connection counts this surface has no use for. */
export interface PlatformPersonRow {
  email: string; display_name: string; role: 'superadmin' | 'member'; status: string; created_at: string;
  teams: { team: string; role: 'admin' | 'member'; added_by: string | null; added_at: string }[];
}
