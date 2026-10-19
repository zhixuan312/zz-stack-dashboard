/**
 * Why the console turned a signed-in session away: the code the page gate (`src/data/access.ts`) sends to sign-in as
 * `?reason=`, and the one sentence the sign-in page says for each.
 *
 * DELIBERATE: a closed table of fixed sentences, never words the address carries. Anybody can write a sign-in address
 * with any `reason` on this console's own origin, and a banner that repeated it would show their instructions above
 * the passkey button as the platform's own. A code the table does not have is said as no code at all.
 */
export const REFUSALS = {
  door: 'You are signed in, but through a token or another way in that this console does not accept. Sign in here with your passkey.',
  refused: 'The platform turned this session away, so nothing here is open to you.',
  unplaced: 'The platform named you in a way this console cannot place, so nothing here is open to you.',
} as const;

export type RefusalCode = keyof typeof REFUSALS;

/** The sentence the sign-in page says for `reason`: its code's, or the one for a session the platform refused. */
export function refusalSentence(reason: string | null): string {
  return reason !== null && Object.hasOwn(REFUSALS, reason) ? REFUSALS[reason as RefusalCode] : REFUSALS.refused;
}
