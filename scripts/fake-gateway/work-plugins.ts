/**
 * The fake gateway's Plugins and skills: what `GET /api/console/plugins`, `/skills?plugin` and `/skills/:name` answer.
 *
 * Two fixtures read together. The catalog (`CATALOG` in platform.ts) is the platform's and the same for everybody, with
 * each plugin's latest public score and whether its scores compare, one selection with the platform's Evaluation read
 * (`platform-evaluation.ts`), the protocol's key the superadmin's alone. The use is the caller's active team's: its
 * calls, refusals and last runs of each plugin and skill are counted from its own recorded runs (`work-runs.ts`), so
 * another team's runs change none of them.
 *
 * The plugins cover what the pages draw: `zz-core` and `zz-access` are required and the rest optional; `sdlc`'s scores
 * do not compare across its protocol versions, `zz-core`'s across its populations, and `zz-plugin-eval`'s do; `zz-access`
 * and `research-kit` were never scored, and nobody ran `research-kit`.
 *
 * COUPLED: zz-stack's `checks/console-work-plugins.ts` imports this file with plain `node` and compares its key sets
 * with the real routes' answers. So nothing here is imported through the console's path alias.
 */
import type { Me, PluginRow, Skill, SkillDetail } from '../../src/lib/api-shapes.ts';
import type { PluginScore } from '../../src/lib/destination-shapes.ts';
import { CATALOG, CATALOG_SKILLS } from './platform.ts';
import { evaluation } from './platform-evaluation.ts';
import { NO_TEAM } from './work-activity.ts';
import { mean, median, runsOf, type TeamRun } from './work-runs.ts';

type Answer = [status: number, body: unknown];

/** The platform's marketplace, which every install line names. */
const MARKETPLACE = 'zz-stack';
/** What every client installs: the platform and the shelved catalog entries. */
const REQUIRED = new Set(['zz-core', 'zz-access']);
/** What a plugin nothing scored says about comparing its scores. */
const UNSCORED = 'No score to compare';

const latest = (runs: TeamRun[]) => runs.reduce<string | null>((a, r) => (!a || r.lastCallAt > a ? r.lastCallAt : a), null);

/** The latest score of `plugin` that has a value, as the Evaluation read answers `who`, with its series' statement. */
function scoreOf(plugin: string, admin: boolean): { score: PluginScore | null; comparability: string } {
  const read = evaluation(admin);
  const history = read.history.state === 'ok' ? read.history.data.find((h) => h.plugin === plugin) : undefined;
  const scored = (history?.series ?? []).flatMap((s) => s.runs.flatMap((r) => (r.score === null ? [] : [{ ...r, score: r.score, protocol: s.protocol }])))
    .sort((a, b) => b.scoredAt.localeCompare(a.scoredAt))[0];
  if (!history || !scored) return { score: null, comparability: UNSCORED };
  return {
    score: { value: scored.score, lower: scored.lower, upper: scored.upper, standing: scored.standing as PluginScore['standing'], protocol: scored.protocol, scoredAt: scored.scoredAt },
    comparability: history.statement,
  };
}

/** `GET /plugins`, as `who`: the catalog, each plugin's public score, and the active team's use of it. */
export function plugins(who: Me): Answer {
  const team = who.activeTeam;
  if (!team) return NO_TEAM;
  const mine = runsOf(team);
  const rows = CATALOG.map((p): PluginRow => {
    const skills = CATALOG_SKILLS.filter((s) => s.plugin === p.plugin);
    const used = mine.filter((r) => skills.some((s) => s.name === r.skill));
    return {
      ...p,
      // A flow is a package that declares documents, as the catalog's one classifier decides.
      flow: p.documents.length > 0,
      skills: skills.map((s) => {
        const runs = mine.filter((r) => r.skill === s.name);
        return {
          name: s.name, position: s.position, isEntry: s.name === p.entry, origin: s.origin, version: s.version, description: s.description, source: s.source,
          versions: p.plugin === 'research-kit' ? 1 : 3 + (s.name.length % 5), calls: runs.reduce((n, r) => n + r.calls, 0),
          everRun: runs.length > 0, lastRun: latest(runs),
        };
      }),
      required: REQUIRED.has(p.plugin),
      install: `claude plugin install ${p.plugin}@${MARKETPLACE}`,
      ...scoreOf(p.plugin, who.superadmin),
      yourTeam: { calls: used.reduce((n, r) => n + r.calls, 0), failed: used.reduce((n, r) => n + r.refusals, 0), lastRun: latest(used) },
    };
  });
  // The team's most recently used first, what it never ran last, as the gateway orders them.
  rows.sort((a, b) => (b.yourTeam.lastRun ?? '').localeCompare(a.yourTeam.lastRun ?? '') || a.plugin.localeCompare(b.plugin));
  return [200, { plugins: rows }];
}

/** One skill's runs by the team, as `/skills` answers a row: durations in seconds over runs longer than one call. */
function skillRow(name: string, runs: TeamRun[]): Skill {
  const s = CATALOG_SKILLS.find((x) => x.name === name)!;
  const calls = runs.reduce((n, r) => n + r.calls, 0);
  const refusals = runs.reduce((n, r) => n + r.refusals, 0);
  const timed = runs.filter((r) => r.calls > 1).map((r) => r.lengthMs / 1000);
  const measured = runs.flatMap((r) => (r.bytes === null ? [] : [r.bytes]));
  const kb = mean(measured);
  return {
    name, version: s.version, kind: 'plugin_skill', flow: s.plugin === 'sdlc' ? 'sdlc-flow' : null, retired: false,
    runs: runs.length, calls, callsAvg: +(calls / runs.length).toFixed(1), callsMax: Math.max(...runs.map((r) => r.calls)), refusals,
    timedRuns: timed.length, durationAvg: mean(timed), durationMedian: median(timed), durationMax: timed.length ? Math.max(...timed) : null,
    durationTotal: timed.length ? timed.reduce((a, b) => a + b, 0) : null,
    kbPerRun: kb === null ? null : +(kb / 1024).toFixed(1), mbTotal: measured.length ? +(measured.reduce((a, b) => a + b, 0) / 1_048_576).toFixed(1) : null,
    logged: { calls, failed: refusals, tools: 3 + (name.length % 6) },
  };
}

/** `GET /skills?plugin`, as `who`: every skill the active team ran, or one plugin's; an unknown plugin answers none. */
export function skills(who: Me, q: URLSearchParams): Answer {
  const team = who.activeTeam;
  if (!team) return NO_TEAM;
  const plugin = q.get('plugin');
  const mine = runsOf(team);
  const names = [...new Set(mine.map((r) => r.skill))]
    .filter((n) => plugin === null || CATALOG_SKILLS.some((s) => s.name === n && s.plugin === plugin)).sort();
  return [200, { skills: names.map((n) => skillRow(n, mine.filter((r) => r.skill === n))) }];
}

/** `GET /skills/:name`, as `who`: the active team's calls of one skill by door and its busiest tools; a skill the
 *  catalog does not ship has no figures, as the gateway answers it. */
export function skillDetail(who: Me, name: string): Answer {
  const team = who.activeTeam;
  if (!team) return NO_TEAM;
  const runs = runsOf(team).filter((r) => r.skill === name);
  const calls = runs.reduce((n, r) => n + r.calls, 0);
  const refusals = runs.reduce((n, r) => n + r.refusals, 0);
  if (!calls) return [200, { skill: name, surfaces: [], busiestTools: [] } satisfies SkillDetail];
  const tools = ['document_edit', 'document_approve', 'document_read', 'skill_read', 'source_add', 'document_write', 'knowledge_search'];
  const core = Math.round(calls * 0.92);
  return [200, {
    skill: name,
    surfaces: [{ surface: 'core', calls: core, failed: Math.round(refusals * 0.9), tools: 6 }, { surface: 'eval', calls: calls - core, failed: refusals - Math.round(refusals * 0.9), tools: 2 }],
    busiestTools: tools.map((t, i) => ({ tool: `core:${t}`, calls: Math.round(calls / (i + 1.4)), failed: Math.round(refusals / (i + 2)) })),
  } satisfies SkillDetail];
}
