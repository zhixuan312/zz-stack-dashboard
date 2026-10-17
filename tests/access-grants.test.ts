import { describe, expect, it } from 'vitest';
import { FEATURES } from '@/data/features';
import { PREPARED } from '@/data/prepared';
import { GRANTS, MAIN_ROLES, effective } from '@/data/roles';

/** The spec's grants table, written out here and not read from the code under test. */
const BOTH = ['work:read', 'platform:read', 'documents:approve', 'initiatives:close', 'tokens:manage'];
const SUPERADMIN_ONLY = ['fleet:read', 'bugs:resolve', 'teams:manage', 'people:manage'];

describe('the role table', () => {
  it('has exactly the two roles the platform has', () => {
    expect([...MAIN_ROLES]).toEqual(['Superadmin', 'Member']);
  });

  it('gives both roles what everybody holds', () => {
    for (const role of MAIN_ROLES) for (const grant of BOTH) expect(effective(role, []).has(grant as never)).toBe(true);
  });

  it('gives the fleet and its actions to a superadmin alone', () => {
    for (const grant of SUPERADMIN_ONLY) {
      expect(effective('Superadmin', []).has(grant as never)).toBe(true);
      expect(effective('Member', []).has(grant as never)).toBe(false);
    }
  });

  it('holds no grant the spec does not name', () => {
    const named = new Set([...BOTH, ...SUPERADMIN_ONLY]);
    for (const role of MAIN_ROLES) for (const grant of GRANTS[role]) expect(named.has(grant)).toBe(true);
  });
});

describe('the feature table', () => {
  it('never leaves a page open to anyone signed in', () => {
    for (const [id, feature] of Object.entries(FEATURES as Record<string, { needs: unknown }>)) {
      expect(feature.needs, id).not.toBe('public');
    }
  });
});

describe('the collections the assistant reads', () => {
  /**
   * What reading each needs: the grant of the page that shows its figures (reconciliation 67), so a member reads what
   * Knowledge, Activity, Runs, Plugins and Access show and never what Teams, People and Audit show. Written out here.
   */
  const NEEDS: Record<string, string> = {
    closures: 'work:read', opened: 'work:read', words: 'work:read', approvals: 'work:read', lessons: 'work:read',
    runs: 'work:read', searches: 'work:read', calls: 'work:read', refusals: 'work:read', output: 'work:read',
    skill_calls: 'work:read', shelf: 'work:read', tokens: 'work:read',
    platform_calls: 'platform:read', platform_refusals: 'platform:read', malformed: 'platform:read', releases: 'platform:read',
    migrations: 'platform:read', bugs_filed: 'platform:read', bugs_resolved: 'platform:read', findings: 'platform:read',
    scores: 'platform:read', platform_lessons: 'platform:read', platform_searches: 'platform:read', model_calls: 'platform:read',
    teams: 'fleet:read', people: 'fleet:read', sign_ins: 'fleet:read', audit: 'fleet:read',
  };

  it('asks of each what the page that shows it asks', () => {
    expect(Object.fromEntries(PREPARED.map((r) => [r.name, r.needs]))).toEqual(NEEDS);
  });
});
