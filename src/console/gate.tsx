/**
 * The one page gate and the title a gated page carries, in the presentation layer because each answers with a view.
 *
 * It lived in `src/data/access.ts` until 0.28.0 opened the console against Meridian's four-layer standard: the data
 * layer reads records and answers rows, and it imports neither `src/logic/` nor `src/views/` (`data-imports-neither`).
 * What this module reads is one policy answer — `identity` — and what it gives back is an element or a redirect.
 */
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { JSX } from 'react';
import { refusal } from '@/app.config';
import { NoAccess } from '@/console/no-access';
import { identity, satisfies } from '@/data/access';
import { FEATURES, type FeatureId } from '@/data/features';
import { ownPath } from '@/lib/own-path';
import { MISSING_METADATA } from '@/logic/missing';

// COUPLED: `proxy.ts` writes this header on every page request, over whatever the browser sent. The two move together.
const PATH_HEADER = 'x-zz-path';

/** Where sign-in sends the person back to: the address this request asked for, when `proxy.ts` said it and it is this site's. */
async function signIn(): Promise<string> {
  const asked = (await headers()).get(PATH_HEADER);
  return asked !== null && ownPath(asked) ? `/login?next=${encodeURIComponent(asked)}` : '/login';
}

/**
 * The one page gate, called as every page's first statement so the check is what stops the read, never the rail:
 * `chromeAccess().only` hides a destination but forbids nothing.
 *
 * A request with no session is sent to sign in, with the address it asked for. A session the console is refused, or
 * one the role table cannot place, is sent to the sign-in page's denied state with the code that says why, which the
 * page shows as its own fixed sentence: never words the address could carry. A person
 * who lacks the feature's grant gets the product's `refusal` as a normal 200 answer (`NoAccess`): under `absent` the
 * missing page, exactly what an address that names nothing draws, and under `explain` the page's title and who can open
 * it. It is awaited because the view is an async server component and a page hands a renderer an element, not a
 * promise. Neither throws `notFound()`. `null` means the feature is held and the page may render. An outage is thrown:
 * nothing is opened on an answer the gateway did not give.
 */
export async function gate(feature: FeatureId): Promise<JSX.Element | null> {
  const who = await identity();
  if (who.is === 'nobody') redirect(await signIn());
  if (who.is === 'refused') redirect(`/login?denied=1&reason=${who.reason}`);
  if (!satisfies(who.role, FEATURES[feature].needs)) return await NoAccess({ feature });
  return null;
}

/**
 * The title a gated page carries, called from its `generateMetadata` so the tab agrees with what `gate` answers: under
 * `refusal: 'absent'` a person the role table places who lacks the feature's grant gets the missing page's title, kept
 * out of search, and anyone else the page's own. Under `explain` the page's own title is the answer for everyone, as the
 * no-access view names the page anyway, and nobody is read. Nobody, or a session the console refuses, keeps the page's
 * own title: `gate` sends either to sign in.
 */
export async function gatedMetadata(feature: FeatureId, metadata: Metadata): Promise<Metadata> {
  if (refusal !== 'absent') return metadata;
  const who = await identity();
  if (who.is !== 'person' || satisfies(who.role, FEATURES[feature].needs)) return metadata;
  return MISSING_METADATA;
}
