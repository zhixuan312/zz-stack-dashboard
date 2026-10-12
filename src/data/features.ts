/**
 * What each destination needs of the person opening it, in one table: a view tool and a collection ask it by
 * reference, so an agent is offered a view or a list exactly where the rail offers the page.
 *
 * The needs are read off `nav` in `src/app.config.ts` rather than restated: a destination marked `platformOnly` there
 * is a fleet surface the rail shows a superadmin, and that is the one rule here too. Two grants exist. `public` is any
 * signed-in person the console lets in; `platform:read` is a superadmin.
 *
 * This says what an agent is offered, never what a person may read: the gateway decides that on every request, from
 * the caller's own credential, and a list an agent is handed still arrives scoped by it.
 */
import { nav } from '@/app.config';
import type { Need } from '@/lib/collection';

/** The grant a fleet surface asks for. */
export const PLATFORM: Need = 'platform:read';

const DESTINATIONS = nav.flatMap((g) => g.items);
const needOf = (href: string): Need => (DESTINATIONS.find((i) => i.href === href)?.platformOnly ? PLATFORM : 'public');

export const FEATURES = {
  overview: { href: '/', needs: needOf('/') },
  teams: { href: '/teams', needs: needOf('/teams') },
  initiatives: { href: '/initiatives', needs: needOf('/initiatives') },
  plugins: { href: '/plugins', needs: needOf('/plugins') },
  knowledge: { href: '/knowledge', needs: needOf('/knowledge') },
  runs: { href: '/runs', needs: needOf('/runs') },
  activity: { href: '/activity', needs: needOf('/activity') },
  people: { href: '/people', needs: needOf('/people') },
  settings: { href: '/settings', needs: needOf('/settings') },
} as const satisfies Record<string, { href: string; needs: Need }>;
