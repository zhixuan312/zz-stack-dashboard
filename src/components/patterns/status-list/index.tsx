'use client';

import { cn } from '../../../lib/cn';
import { formatDuration } from '../../../lib/format';
import { StatusDot } from '../../ui/status-dot/index';
import type { Tone } from '../../ui/badge/index';
import { UptimeBars } from '../../charts/uptime-bars/index';
import { summarise, SERVICE_NOUN, type Noun } from './summarise';

export { summarise };

const STATE: Record<ServiceStatus, { tone: Tone; word: string; ink: string }> = {
  operational: { tone: 'positive', word: 'Operational', ink: 'text-positive-ink' },
  degraded: { tone: 'warning', word: 'Degraded', ink: 'text-warning-ink' },
  outage: { tone: 'critical', word: 'Outage', ink: 'text-critical-ink' },
};


export type ServiceStatus = 'operational' | 'degraded' | 'outage';
/** A service: what it is, its state now, its uptime and latency, and one state per day, oldest first. */
export type Service = { name: string; description: string; status: ServiceStatus; uptime: number; latency: number; days: ServiceStatus[] };
/**
 * What every row repeats, written once on the list: the row's grid, its hairline, and where its three parts sit (the
 * name, the bars, the state) on a wide card and on a narrow one. Literal strings, so Tailwind finds them.
 */
const ROWS = [
  '[&>li]:grid [&>li]:grid-cols-[minmax(0,1fr)_auto] [&>li]:items-center [&>li]:gap-x-6 [&>li]:gap-y-3 [&>li]:border-b [&>li]:border-line [&>li]:px-(--card-pad) [&>li]:py-4 [&>li:last-child]:border-0 @2xl:[&>li]:grid-cols-[minmax(12rem,15rem)_minmax(0,1fr)_5.5rem]',
  '[&>li>div:nth-child(2)]:col-span-2 [&>li>div:nth-child(2)]:row-start-2 [&>li>div:nth-child(2)]:min-w-0 @2xl:[&>li>div:nth-child(2)]:col-span-1 @2xl:[&>li>div:nth-child(2)]:row-start-auto',
  '[&>li>div:nth-child(3)]:col-start-2 [&>li>div:nth-child(3)]:row-start-1 [&>li>div:nth-child(3)]:text-right @2xl:[&>li>div:nth-child(3)]:col-start-auto @2xl:[&>li>div:nth-child(3)]:row-start-auto',
].join(' ');

/**
 * Every service and how it is right now: a dot and a word for its state, its latency, and ninety days of history as
 * uptime bars. The summary line on top says the worst state in words. On a wide card the bars sit beside each service;
 * on a narrow one (a phone, an embed) they drop underneath, every day still shown.
 */
export function StatusList({
  services,
  end,
  summary = true,
  descriptions = true,
  noun = SERVICE_NOUN,
  measure,
  metric = (svc) => `p95 ${formatDuration(svc.latency)}`,
  className,
}: {
  services: Service[];
  /** The last day of the history: today. */
  end: Date;
  /** Show the summary line above the rows. */
  summary?: boolean;
  /** Show each service's one-line description (off in an inline embed). */
  descriptions?: boolean;
  /** What the rows are, for the summary and the count: services by default; sites, branches, warehouses. */
  noun?: Noun;
  /** The word after each row's percentage; see Uptime bars. */
  measure?: string;
  /** The figure under each row's state word; p95 latency by default. */
  metric?: (svc: Service) => string;
  className?: string;
}) {
  const s = summarise(services, noun);
  const head = STATE[s.status];
  return (
    <div className={cn('@container min-w-0', className)}>
      {summary ? (
        <div role="status" className="flex items-center gap-3 border-b border-line px-(--card-pad) py-4">
          <StatusDot tone={head.tone} live={s.status !== 'operational'} className="size-2.5" />
          <p className={cn('text-md font-semibold tracking-[-0.012em]', s.status === 'operational' ? 'text-ink' : head.ink)}>{s.text}</p>
          <p className="t-caption ml-auto hidden @md:block">{services.length} {services.length === 1 ? noun.one : noun.other}</p>
        </div>
      ) : null}
      <ul className={ROWS}>
        {services.map((svc) => {
          const st = STATE[svc.status];
          return (
            <li key={svc.name}>
              <div className="min-w-0">
                <p className="flex items-center gap-2.5">
                  <StatusDot tone={st.tone} live={svc.status !== 'operational'} />
                  <span className="truncate text-sm font-medium">{svc.name}</span>
                </p>
                {descriptions ? <p className="t-caption mt-1 pl-[18px] text-pretty">{svc.description}</p> : null}
              </div>
              <div>
                <UptimeBars days={svc.days} uptime={svc.uptime} end={end} label={`${svc.name}, last 90 days`} measure={measure} />
              </div>
              <div>
                <p className={cn('text-xs font-medium', st.ink)}>{st.word}</p>
                <p className="t-num t-caption mt-0.5">{metric(svc)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
