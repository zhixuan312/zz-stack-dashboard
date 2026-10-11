import type { Service, ServiceStatus } from './';
import { plural } from '../../../lib/format';

export type Noun = { one: string; other: string };
export const SERVICE_NOUN: Noun = { one: 'service', other: 'services' };

/** The worst state among the items, in words: the line a reader takes away. `noun` names what they are. */
export function summarise(services: Service[], noun: Noun = SERVICE_NOUN) {
  const down = services.filter((s) => s.status === 'outage').length;
  const degraded = services.filter((s) => s.status === 'degraded').length;
  if (down) return { status: 'outage' as const, text: `${down} ${plural(down, `${noun.one} is`, `${noun.other} are`)} down` };
  if (degraded) return { status: 'degraded' as const, text: `${degraded} ${plural(degraded, noun.one, noun.other)} degraded` };
  return { status: 'operational' as const, text: `All ${noun.other} operational` };
}

const GLYPH: Record<ServiceStatus, string> = { operational: 'o', degraded: 'd', outage: 'x' };
const STATE_OF = Object.fromEntries(Object.entries(GLYPH).map(([state, glyph]) => [glyph, state])) as Record<string, ServiceStatus>;

/** A service whose history crosses the server-client boundary as one character per day: `ooodox…`, oldest first. */
export type PackedService = Omit<Service, 'days'> & { days: string };

/** Ninety days as a 90-character string instead of ninety words: a page that sends several services sends them this way. */
export const packServices = (services: Service[]): PackedService[] => services.map((s) => ({ ...s, days: s.days.map((d) => GLYPH[d]).join('') }));

/** The inverse of `packServices`, in the client component that draws the strips. */
export const unpackServices = (services: PackedService[]): Service[] => services.map((s) => ({ ...s, days: [...s.days].map((g) => STATE_OF[g]) }));
