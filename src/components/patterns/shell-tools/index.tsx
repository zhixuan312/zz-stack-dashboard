'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell, Search } from 'lucide-react';
import { slug } from '../../../app.config';
import { cn } from '../../../lib/cn';
import { formatDateTime, formatRelative } from '../../../lib/format-date';
import { Kbd } from '../../ui/kbd/index';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover/index';
import { StatusDot, TONE_WORD } from '../../ui/status-dot/index';
import { openCommand, usePaletteKey } from '../command-palette/open';

/** One thing that needs a person: what happened, where to act on it, and whether they have seen it. */
export type Alert = {
  id: string;
  title: string;
  detail?: string;
  at: string;
  href: string;
  tone: 'critical' | 'warning' | 'positive' | 'neutral';
  unread?: boolean;
  /**
   * What kind of thing this alert is, in a short label: "Incidents", "Verifications". Alerts that share one are drawn
   * under one heading with their own unread count, in the order the kinds first appear, so a failing check never reads
   * with the weight of an incident (#123). An alert with no `group` is listed as it always was.
   */
  group?: string;
};


/** The alerts this tab has opened, kept for the session so a reload does not bring them back as new. */
const READ_KEY = `${slug}.alerts-read`;
const readIds = (): string[] => {
  try { const ids: unknown = JSON.parse(sessionStorage.getItem(READ_KEY) ?? '[]'); return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []; } catch { return []; }
};

/**
 * The global tools in the top bar of every console page: search and commands (⌘K), and alerts. They stay put while
 * the page scrolls, so they are always one press away. Alerts open a panel; each alert links to where it is handled.
 */
export function ShellTools({ alerts = [], now }: { alerts?: Alert[]; /** The data's clock, for "36 min ago". */ now: Date }) {
  const [read, setRead] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  // Read after hydration: the server render has no session storage.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- session storage is an external store read once on mount.
  useEffect(() => setRead(new Set(readIds())), []);
  const keep = (next: Set<string>) => {
    setRead(next);
    try { sessionStorage.setItem(READ_KEY, JSON.stringify([...next])); } catch {}
  };
  const unread = alerts.filter((a) => a.unread && !read.has(a.id)).length;
  const name = unread ? `Alerts, ${unread} new` : 'Alerts';
  const markAll = () => keep(new Set([...read, ...alerts.map((a) => a.id)]));
  const paletteKey = usePaletteKey();
  return (
    <>
      <button
        type="button"
        onClick={openCommand}
        className="press hit flex h-9 items-center gap-2.5 rounded-full border border-line-strong bg-surface/60 pr-1.5 pl-3 text-sm text-ink-3 shadow-control backdrop-blur-md transition-[color,background-color,border-color,transform] hover:border-line-control/40 hover:text-ink-2 @max-[40rem]:w-9 @max-[40rem]:justify-center @max-[40rem]:px-0"
      >
        <Search className="size-4" strokeWidth={1.75} />
        {/* Below 40rem the word is only its own name: `sr-only`, never `hidden`, so the icon-only button is still announced (#83). */}
        <span className="w-36 text-left @max-[48rem]:w-20 @max-[40rem]:sr-only">Search</span>
        <Kbd className="keyboard-only @max-[40rem]:hidden">{paletteKey}</Kbd>
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={name} title={name} className="press hit relative grid size-9 place-items-center rounded-full border border-line-strong bg-surface/60 text-ink-2 shadow-control backdrop-blur-md hover:text-ink data-[state=open]:text-ink">
            <Bell className="size-4" strokeWidth={1.75} />
            {unread ? <span className="absolute top-2 right-2 size-2 rounded-full bg-accent ring-2 ring-ground" /> : null}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-88 p-0" aria-label="Alerts">
          <AlertsPanel alerts={alerts} now={now} read={read} onOpen={(id) => { keep(new Set(read).add(id)); setOpen(false); }} onMarkAll={markAll} />
        </PopoverContent>
      </Popover>
    </>
  );
}

/** The alerts panel's body, as drawn in the popover; exported so a preview draws exactly what the bell opens. */
export function AlertsPanel({ alerts, now, read = new Set(), onOpen, onMarkAll }: { alerts: Alert[]; now: Date; read?: Set<string>; onOpen?: (id: string) => void; onMarkAll?: () => void }) {
  const unread = alerts.filter((a) => a.unread && !read.has(a.id)).length;
  // The alerts under the heading of their kind, the kinds in the order they first appear. An alert with no kind stands
  // first, under no heading, as the alert of no particular sort always did.
  const grouped: [string | null, Alert[]][] = [];
  for (const a of alerts) {
    const name = a.group ?? null;
    const at = grouped.findIndex(([n]) => n === name);
    if (at < 0) grouped.push([name, [a]]);
    else grouped[at][1].push(a);
  }
  return (
    <>
      {/* The head wraps: in a narrow card the count and "Mark all read" drop under the title instead of running past it. */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <p className="text-sm font-semibold">Alerts</p>
        {unread ? <span className="t-caption">{unread} new</span> : null}
        {unread && onMarkAll ? (
          <button type="button" onClick={onMarkAll} className="hit ml-auto rounded-xs text-xs font-medium text-accent-ink hover:text-ink">
            Mark all read
          </button>
        ) : null}
      </div>
      {alerts.length ? (
        <div className="max-h-96 overflow-y-auto p-1.5">
          {grouped.map(([name, items]) => {
            // One heading per kind, in the order the kinds first appear, each with its own unread count. The kinds are the
            // point: interleaved by time, a failing check read with the same weight as an incident (#123).
            const fresh = items.filter((a) => a.unread && !read.has(a.id)).length;
            return (
              <section key={name ?? ''} data-alert-group={name ?? undefined} aria-label={name ?? undefined} className="not-first:mt-1">
                {name ? (
                  <p className="flex items-center gap-2 px-2.5 pt-2 pb-1 text-2xs font-semibold tracking-wide text-ink-3 uppercase">
                    {name}
                    {fresh ? <span className="t-num normal-case tracking-normal text-warning-ink">{fresh} new</span> : null}
                  </p>
                ) : null}
                <ul>
                  {items.map((a) => {
                    const isNew = a.unread && !read.has(a.id);
                    return (
                      <li key={a.id}>
                        <Link href={a.href} onClick={() => onOpen?.(a.id)} className="grid grid-cols-[14px_minmax(0,1fr)] gap-x-3 rounded-md px-2.5 py-2.5 hover:bg-fill-hover">
                          <span className="mt-1.5 grid size-3.5 place-items-center"><StatusDot tone={a.tone} label={TONE_WORD[a.tone]} live={isNew && a.tone !== 'neutral'} /></span>
                          <span className="min-w-0">
                            <span className={cn('block text-sm', isNew ? 'font-medium text-ink' : 'text-ink-2')}>{a.title}</span>
                            {a.detail ? <span className="t-caption mt-0.5 block">{a.detail}</span> : null}
                            <time dateTime={a.at} title={formatDateTime(a.at)} className="t-caption t-num mt-1 block">{formatRelative(a.at, now)}</time>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <p className="px-4 py-8 text-center text-sm text-ink-3">Nothing needs you right now.</p>
      )}
    </>
  );
}
