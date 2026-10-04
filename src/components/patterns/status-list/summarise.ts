import type { Service } from '@/components/patterns/status-list';

export type Noun = { one: string; other: string };
export const SERVICE_NOUN: Noun = { one: 'service', other: 'services' };

/** The worst state among the items, in words: the line a reader takes away. `noun` names what they are. */
export function summarise(services: Service[], noun: Noun = SERVICE_NOUN) {
  const down = services.filter((s) => s.status === 'outage').length;
  const degraded = services.filter((s) => s.status === 'degraded').length;
  if (down) return { status: 'outage' as const, text: `${down} ${down === 1 ? `${noun.one} is` : `${noun.other} are`} down` };
  if (degraded) return { status: 'degraded' as const, text: `${degraded} ${degraded === 1 ? noun.one : noun.other} degraded` };
  return { status: 'operational' as const, text: `All ${noun.other} operational` };
}
