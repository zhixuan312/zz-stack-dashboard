/**
 * A person a test signs in as beyond the fake gateway's two (`ME` and `MEMBER` in `scripts/fake-gateway/people.ts`,
 * which tests import from there): a member acting for a team other than the superadmin's, which the fake has no
 * session for. It is the fake's member moved to `beacon`, admin of it as the platform makes every person it adds, so
 * what it differs in is visible and nothing else is invented.
 */
import type { Me } from '@/lib/api-shapes';
import { MEMBER } from '../scripts/fake-gateway/people.ts';

/** A member of `beacon`, which the superadmin is a member of but does not act for. */
export const BEACON_MEMBER: Me = { ...MEMBER, teams: [{ slug: 'beacon', role: 'admin' }], activeTeam: 'beacon' };
