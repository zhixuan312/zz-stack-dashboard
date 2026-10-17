'use client';

import { cn } from '../../../lib/cn';
import { runOf } from '../../../lib/facts';
import { formatDuration } from '../../../lib/format';
import { StatusDot } from '../../ui/status-dot/index';
import type { Tone } from '../../ui/badge/index';
import { UptimeBars } from '../../charts/uptime-bars/index';
import { summarise, SERVICE_NOUN, type Noun } from './summarise';
import { plural } from '../../../lib/format';

export { summarise };

const STATE: Record<ServiceStatus, { tone: Tone; word: string; ink: string }> = {
  operational: { tone: 'positive', word: 'Operational', ink: 'text-positive-ink' },
  degraded: { tone: 'warning', word: 'Degraded', ink: 'text-warning-ink' },
  outage: { tone: 'critical', word: 'Down', ink: 'text-critical-ink' },
};
/** What a row says of its run when its last day is not an operational one: there is no run to count. */
const TODAY: Record<Exclude<ServiceStatus, 'operational'>, string> = { degraded: 'Degraded today', outage: 'Down today' };


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
 * How long a service has run: the operational days that end today, counted from the days its strip draws, so the
 * figure and the marks above it are the same days. Today is the strip's last day, whatever `status` says of this
 * minute. A run that goes back to the earliest day kept is at least that long and is never called the longest; a
 * service with no days says nothing.
 */
function Run({ days }: { days: ServiceStatus[] }) {
  const today = days.at(-1);
  if (today === undefined) return null;
  if (today !== 'operational') return <p data-run className="t-caption mt-2"><span className="font-medium text-ink-2">{TODAY[today]}</span></p>;
  const { length, reachesStart, longest } = runOf(days, 'operational');
  return (
    <p data-run className="t-caption mt-2 text-pretty">
      Operational for <span className="t-num font-medium text-ink-2">{reachesStart ? 'at least ' : null}{length} {plural(length, 'day')}</span>
      {longest && !reachesStart ? <> · its longest in {days.length}</> : null}
    </p>
  );
}

/**
 * Every service and how it is right now: a dot and a word for its state, its latency, and ninety days of history as
 * uptime bars. The summary line on top says the worst state in words. On a wide card the bars sit beside each service;
 * on a narrow one (a phone, an embed) they drop underneath, every day still shown. With `run`, each row says under its
 * bars how long the service has been operational.
 */
export function StatusList({
  services,
  end,
  summary = true,
  descriptions = true,
  noun = SERVICE_NOUN,
  measure,
  metric = (svc) => `p95 ${formatDuration(svc.latency)}`,
  run = false,
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
  /** Say under each row's bars how long the service has run: "Operational for 69 days · its longest in 90". */
  run?: boolean;
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
          <p className="t-caption ml-auto hidden @md:block">{services.length} {plural(services.length, noun.one, noun.other)}</p>
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
                {run ? <Run days={svc.days} /> : null}
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
