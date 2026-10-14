/**
 * The platform's roles and what each may do: the role table, and the one place a role name or a grant is written. A
 * policy asks `effective` what a person holds, and the refused view asks `whoCan` which roles satisfy a need.
 *
 * The platform has two roles and no add-ons: a person is a superadmin or a member, and the gateway says which
 * (`/me.role`). There is no wildcard and no deny, so a grant is never taken away by another rule.
 *
 * This says what the console offers a person, never what they may read: the gateway decides that on every request,
 * from the caller's own credential.
 */
import type { Grant } from '@/lib/collection';

/**
 * What a grant permits here: one of Meridian's four operations on an object, or one of the platform's own actions on
 * it. Meridian's `Grant` has no word for the second, and its file is not this console's to edit.
 */
export type ConsoleGrant = Grant | `${string}:${'approve' | 'close' | 'manage' | 'resolve'}`;
/** A need one grant satisfies on its own, or several that must all hold. */
type ConsoleProtectedNeed = ConsoleGrant | { readonly allOf: readonly [ConsoleGrant, ...ConsoleGrant[]] };
/** A need with no grant behind it: anyone the console lets in satisfies it. */
export type ConsoleNeed = ConsoleProtectedNeed | 'public';

/** The role every person has, in table order: the platform's own two, capitalised. */
export const MAIN_ROLES = ['Superadmin', 'Member'] as const;

export type MainRole = (typeof MAIN_ROLES)[number];

/** What everybody holds: their own work, the platform's public pages, and the actions a person takes on their own work. */
const EVERYBODY = ['work:read', 'platform:read', 'documents:approve', 'initiatives:close', 'tokens:manage'] as const;

/** Each role's own grants. The fleet and what is done to it are a superadmin's alone. */
export const GRANTS = {
  Superadmin: [...EVERYBODY, 'fleet:read', 'bugs:resolve', 'teams:manage', 'people:manage'],
  Member: EVERYBODY,
} as const satisfies Record<MainRole, readonly ConsoleGrant[]>;

/** Everything a person may do: their role's grants. The second argument is Meridian's add-ons, of which the platform has none. */
export function effective(role: MainRole, _addOns: readonly never[] = []): ReadonlySet<ConsoleGrant> {
  return new Set<ConsoleGrant>(GRANTS[role]);
}

/** The roles whose own grants satisfy all of `need`, in table order. */
export function whoCan(need: ConsoleProtectedNeed): MainRole[] {
  const grants = typeof need === 'string' ? [need] : need.allOf;
  return MAIN_ROLES.filter((role) => grants.every((grant) => effective(role).has(grant)));
}
