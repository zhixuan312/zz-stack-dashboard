'use client';

import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { ArrowLeft, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Badge, type Tone } from '@/components/ui/badge';
import { IconButton } from '@/components/ui/icon-button';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';

export type DetailAction = { label: string; icon?: ReactNode; onSelect: () => void; tone?: 'critical' };

export type DetailHeadProps = {
  /** The list this record belongs to: the way back. */
  parent: { label: string; href: string };
  /** The record's name, or its ID when it has no name. */
  name: string;
  /** Set the name in mono: an ID, a hash, a key. */
  mono?: boolean;
  status?: { tone: Tone; label: string };
  /** Three to five facts that identify the record at a glance, in reading order. */
  facts?: ReactNode[];
  /** The one main action. */
  primary?: ReactNode;
  /** Every other action, in a menu. A destructive one goes last, after a separator. */
  more?: DetailAction[];
};

function Name({ name, mono, status }: Pick<DetailHeadProps, 'name' | 'mono' | 'status'>) {
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-x-4 gap-y-2 align-middle">
      <span className={cn('min-w-0', mono ? 'break-all' : 'text-balance break-words', mono && 'font-mono font-medium tracking-[-0.02em] [h1_&]:text-[0.6em]')}>{name}</span>
      {status ? <Badge tone={status.tone} dot className="translate-y-0.5 text-xs font-medium tracking-[0]">{status.label}</Badge> : null}
    </span>
  );
}

function Facts({ facts }: { facts: ReactNode[] }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {facts.map((f, i) => (
        <Fragment key={i}>
          {i > 0 ? <span aria-hidden className="size-1 rounded-full bg-ink-3/60" /> : null}
          <span className="t-num">{f}</span>
        </Fragment>
      ))}
    </span>
  );
}

function Actions({ primary, more }: Pick<DetailHeadProps, 'primary' | 'more'>) {
  const safe = more?.filter((a) => a.tone !== 'critical') ?? [];
  const risky = more?.filter((a) => a.tone === 'critical') ?? [];
  return (
    <>
      {more?.length ? (
        <Menu>
          <MenuTrigger asChild>
            <IconButton variant="secondary" label="More actions" icon={<MoreHorizontal />} />
          </MenuTrigger>
          <MenuContent align="end">
            {safe.map((a) => <MenuItem key={a.label} onSelect={a.onSelect}>{a.icon}{a.label}</MenuItem>)}
            {safe.length && risky.length ? <MenuSeparator /> : null}
            {risky.map((a) => <MenuItem key={a.label} tone="critical" onSelect={a.onSelect}>{a.icon}{a.label}</MenuItem>)}
          </MenuContent>
        </Menu>
      ) : null}
      {primary}
    </>
  );
}

/**
 * A record's masthead: the way back to its list, its name (or ID, in mono) with its state, the facts that identify it,
 * and its actions. Spread it into a PageFrame, so a detail page keeps the one masthead and its condensing top bar:
 *
 *   <PageFrame {...detailHead({ parent, name, status, facts, primary, more })}>…</PageFrame>
 */
export function detailHead(p: DetailHeadProps) {
  return {
    kicker: (
      <Link href={p.parent.href} className="inline-flex items-center gap-1.5 hover:text-ink">
        <ArrowLeft className="size-3" />
        {p.parent.label}
      </Link>
    ),
    title: <Name name={p.name} mono={p.mono} status={p.status} />,
    description: p.facts?.length ? <Facts facts={p.facts} /> : undefined,
    actions: p.primary || p.more?.length ? <Actions primary={p.primary} more={p.more} /> : undefined,
  };
}

/** The same head as a block, for an embed view or a sheet, where there is no PageFrame. */
export function DetailHead({ className, compact, ...p }: DetailHeadProps & { className?: string; compact?: boolean }) {
  const h = detailHead(p);
  return (
    <header className={cn('flex flex-wrap items-end gap-x-6 gap-y-4', className)}>
      <div className="min-w-0 flex-1 basis-80">
        <p className="t-kicker mb-3">{h.kicker}</p>
        <h1 className={compact ? 't-section' : 't-page'}>{h.title}</h1>
        {h.description ? <div className={cn('mt-2.5 text-ink-2', compact ? 'text-sm' : 't-lead')}>{h.description}</div> : null}
      </div>
      {h.actions ? <div className="flex items-center gap-2">{h.actions}</div> : null}
    </header>
  );
}
