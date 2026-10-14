import { describe, expect, it } from 'vitest';
import { FEATURES } from '@/data/features';
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
