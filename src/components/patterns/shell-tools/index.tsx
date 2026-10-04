'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Bell, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDateTime, formatRelative } from '@/lib/format-date';
import { Kbd } from '@/components/ui/kbd';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StatusDot } from '@/components/ui/status-dot';
import { openCommand } from '@/components/patterns/command-palette';

/** One thing that needs a person: what happened, where to act on it, and whether they have seen it. */
export type Alert = { id: string; title: string; detail?: string; at: string; href: string; tone: 'critical' | 'warning' | 'positive' | 'neutral'; unread?: boolean };

/**
 * The global tools in the top bar of every console page: search and commands (⌘K), and alerts. They stay put while
 * the page scrolls, so they are always one press away. Alerts open a panel; each alert links to where it is handled.
 */
export function ShellTools({ alerts = [], now }: { alerts?: Alert[]; /** The data's clock, for "36 min ago". */ now?: Date }) {
  const [read, setRead] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const unread = alerts.filter((a) => a.unread && !read.has(a.id)).length;
  const name = unread ? `Alerts, ${unread} new` : 'Alerts';
  const markAll = () => setRead(new Set(alerts.map((a) => a.id)));
  return (
    <>
      <button
        type="button"
        onClick={openCommand}
        className="press hit flex h-9 items-center gap-2.5 rounded-full border border-line-strong bg-surface/60 pr-1.5 pl-3 text-sm text-ink-3 shadow-control backdrop-blur-md transition-[color,background-color,border-color,transform] hover:border-line-control/40 hover:text-ink-2 max-sm:w-9 max-sm:justify-center max-sm:px-0"
      >
        <Search className="size-4" strokeWidth={1.75} />
        <span className="w-36 text-left max-md:w-20 max-sm:hidden">Search</span>
        <Kbd className="max-sm:hidden">⌘K</Kbd>
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={name} title={name} className="press hit relative grid size-9 place-items-center rounded-full border border-line-strong bg-surface/60 text-ink-2 shadow-control backdrop-blur-md hover:text-ink data-[state=open]:text-ink">
            <Bell className="size-4" strokeWidth={1.75} />
            {unread ? <span className="absolute top-2 right-2 size-2 rounded-full bg-accent ring-2 ring-ground" /> : null}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-88 p-0" aria-label="Alerts">
          <AlertsPanel alerts={alerts} now={now} read={read} onOpen={(id) => { setRead((r) => new Set(r).add(id)); setOpen(false); }} onMarkAll={markAll} />
        </PopoverContent>
      </Popover>
    </>
  );
}

/** The alerts panel's body, as drawn in the popover; exported so a preview draws exactly what the bell opens. */
export function AlertsPanel({ alerts, now, read = new Set(), onOpen, onMarkAll }: { alerts: Alert[]; now?: Date; read?: Set<string>; onOpen?: (id: string) => void; onMarkAll?: () => void }) {
  const unread = alerts.filter((a) => a.unread && !read.has(a.id)).length;
  return (
    <>
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <p className="text-sm font-semibold">Alerts</p>
        {unread ? <span className="t-caption">{unread} new</span> : null}
        {unread && onMarkAll ? (
          <button type="button" onClick={onMarkAll} className="ml-auto rounded-xs text-xs font-medium text-accent-ink hover:underline">
            Mark all read
          </button>
        ) : null}
      </div>
      {alerts.length ? (
        <ul className="max-h-96 overflow-y-auto p-1.5">
          {alerts.map((a) => {
            const isNew = a.unread && !read.has(a.id);
            return (
              <li key={a.id}>
                <Link href={a.href} onClick={() => onOpen?.(a.id)} className="grid grid-cols-[14px_minmax(0,1fr)] gap-x-3 rounded-md px-2.5 py-2.5 hover:bg-fill-hover">
                  <span className="mt-1.5 grid size-3.5 place-items-center"><StatusDot tone={a.tone} live={isNew && a.tone !== 'neutral'} /></span>
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
      ) : (
        <p className="px-4 py-8 text-center text-sm text-ink-3">Nothing needs you right now.</p>
      )}
    </>
  );
}
