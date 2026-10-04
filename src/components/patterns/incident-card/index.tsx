import { cn } from '@/lib/cn';
import { formatDuration } from '@/lib/format';
import { formatDate, formatDateTime, formatRelative } from '@/lib/format-date';
import { Badge, type Tone } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { StatusDot } from '@/components/ui/status-dot';

const STATE: Record<Incident['state'], { tone: Tone; word: string; ink: string; edge: string; border: string }> = {
  investigating: { tone: 'critical', word: 'Investigating', ink: 'text-critical-ink', edge: 'bg-critical', border: 'border-critical/30' },
  monitoring: { tone: 'warning', word: 'Monitoring', ink: 'text-warning-ink', edge: 'bg-warning', border: 'border-warning/30' },
  resolved: { tone: 'positive', word: 'Resolved', ink: 'text-positive-ink', edge: '', border: '' },
};
const SEVERITY: Record<Incident['severity'], { tone: Tone; word: string }> = {
  minor: { tone: 'warning', word: 'Minor' },
  major: { tone: 'critical', word: 'Major' },
};


/** An incident: what broke, where, how bad, its state and its updates, newest last. */
/** Hold hyphenated identifiers such as eu-west-1 on one line; a break after the hyphen reads as two words. */
const keepHyphenated = (text: string) => text.split(/(\S+-\S+)/).map((part, i) => (i % 2 ? <span key={i} className="whitespace-nowrap">{part}</span> : part));

export type Incident = { id: string; title: string; service: string; severity: 'minor' | 'major'; state: 'investigating' | 'monitoring' | 'resolved'; started: string; resolved?: string; updates: { at: string; text: string }[] };
/**
 * An incident, told the way a reader needs it: what is affected, how bad, where it stands, and every update since it
 * started, newest first. A live incident leads with its state; a resolved one with how long it lasted. `row` is the
 * compact form for a list of past incidents: the title wraps rather than losing its end.
 */
export function IncidentCard({ incident, now, variant = 'card', className }: { incident: Incident; now: Date; variant?: 'card' | 'row'; className?: string }) {
  const st = STATE[incident.state];
  const sev = SEVERITY[incident.severity];
  const live = incident.state !== 'resolved';
  const lasted = incident.resolved ? new Date(incident.resolved).getTime() - new Date(incident.started).getTime() : null;

  if (variant === 'row') {
    return (
      <div className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 px-(--card-pad) py-3.5', className)}>
        <p className="min-w-0 text-sm font-medium text-pretty">{keepHyphenated(incident.title)}</p>
        <Badge tone={sev.tone}>{sev.word}</Badge>
        <p className="t-caption min-w-0 text-pretty">
          {incident.service} · <time dateTime={incident.started}>{formatDate(incident.started)}</time>
          {lasted !== null ? <> · lasted {formatDuration(lasted)}</> : null}
        </p>
        <p className={cn('text-right text-xs', st.ink)}>{st.word}</p>
      </div>
    );
  }

  const updates = [...incident.updates].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <Card className={cn('overflow-hidden', live && st.border, className)}>
      {live ? <span aria-hidden className={cn('absolute inset-x-0 top-0 h-0.5', st.edge)} /> : null}
      <div className="px-(--card-pad) pt-(--card-pad)">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={st.tone} dot>{st.word}</Badge>
          <Badge tone={sev.tone}>{sev.word}</Badge>
          <span className="t-caption ml-auto">{incident.id}</span>
        </div>
        <h2 className="t-card mt-4 text-pretty">{keepHyphenated(incident.title)}</h2>
        <p className="t-caption mt-1.5">
          {incident.service} · started <time dateTime={incident.started} title={formatDateTime(incident.started)}>{formatRelative(incident.started, now)}</time>
          {lasted !== null ? <> · lasted {formatDuration(lasted)}</> : null}
        </p>
      </div>
      <ol aria-label="Updates" className="relative mx-(--card-pad) mt-5 mb-(--card-pad) flex flex-col gap-5 border-t border-line pt-5">
        {updates.map((u, i) => (
          <li key={u.at} className="relative grid grid-cols-[14px_minmax(0,1fr)] gap-x-3">
            {i < updates.length - 1 ? <span aria-hidden className="absolute top-4 bottom-[-20px] left-[6.5px] w-px bg-line" /> : null}
            <span aria-hidden className="mt-1.5 grid size-3.5 place-items-center">
              {i === 0 && live ? <StatusDot tone={st.tone} live /> : <span className="size-1.5 rounded-full bg-ink-3" />}
            </span>
            <div className="min-w-0">
              <time dateTime={u.at} title={formatDateTime(u.at)} className="t-caption t-num font-medium">{formatRelative(u.at, now)}</time>
              <p className="t-small mt-1 text-ink-2">{u.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
