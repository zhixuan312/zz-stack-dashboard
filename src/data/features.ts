/**
 * The pages this console offers: one table the rail, the command palette,
 * every page's gate and every view tool ask, so a destination, a page and a tool cannot drift apart.
 *
 * A feature's `needs` is what a person must hold to reach the page behind it, and names grants only: the role names and the grant table stay in `roles.ts`. The nav in
 * `src/app.config.ts` points each item at its feature's need **by reference** (`needs: FEATURES.teams.needs`), so an
 * item and the table never restate one another.
 *
 * This is the table of the eighteen destinations of the spec's destinations table and a bug's own page. Everybody reads
 * their own work, Knowledge, Activity, Runs, Plugins and Access among it, and the platform's Status, Releases, Bugs, Evaluation, Usage and Knowledge health; Teams, People, Audit and
 * a bug's own page are a superadmin's (reconciliation 67).
 *
 * Pure data with type-only imports, so plain `node` can import it: `scripts/check.ts` reads `src/app.config.ts`, which
 * reaches this file.
 */
import type { Grant } from '@/lib/collection';
import type { GRANTS, MainRole } from '@/data/roles';

/** A read some role on the table holds: a page that asked for any other grant would be a page nobody can open. */
type HeldRead = Extract<(typeof GRANTS)[MainRole][number], Grant>;

/** What a person's own work asks for. */
const WORK = 'work:read' satisfies HeldRead;
/** What the platform's public pages ask for: every role holds it, a member as much as a superadmin. */
const PLATFORM = 'platform:read' satisfies HeldRead;
/** What a fleet page asks for: every team's rows, which only a superadmin reads. */
export const FLEET = 'fleet:read' satisfies HeldRead;

/** Every page the console offers, by the id the rail, the palette and a page's gate name it. */
export type FeatureId =
  | 'home' | 'record' | 'initiatives' | 'approvals' | 'knowledge' | 'people' | 'access' | 'teams' | 'plugins' | 'runs' | 'activity'
  | 'platform-status' | 'releases' | 'bugs' | 'bug' | 'evaluation' | 'usage' | 'knowledge-health' | 'audit';

/** Each feature: its name as a person reads it, and the need a person must satisfy to reach it. Never `public`. */
export const FEATURES: Record<FeatureId, { title: string; needs: HeldRead }> = {
  home: { title: 'Home', needs: WORK },
  record: { title: 'Record', needs: WORK },
  initiatives: { title: 'Initiatives', needs: WORK },
  approvals: { title: 'Approvals', needs: WORK },
  knowledge: { title: 'Knowledge', needs: WORK },
  people: { title: 'People', needs: FLEET },
  access: { title: 'Access', needs: WORK },
  teams: { title: 'Teams', needs: FLEET },
  plugins: { title: 'Plugins', needs: WORK },
  runs: { title: 'Runs', needs: WORK },
  activity: { title: 'Activity', needs: WORK },
  'platform-status': { title: 'Status', needs: PLATFORM },
  releases: { title: 'Releases', needs: PLATFORM },
  bugs: { title: 'Bugs', needs: PLATFORM },
  bug: { title: 'Bug report', needs: FLEET },
  evaluation: { title: 'Evaluation', needs: PLATFORM },
  usage: { title: 'Usage', needs: PLATFORM },
  'knowledge-health': { title: 'Knowledge health', needs: PLATFORM },
  audit: { title: 'Audit', needs: FLEET },
};
