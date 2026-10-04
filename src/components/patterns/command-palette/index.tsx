'use client';

import { Dialog as D } from 'radix-ui';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, CornerDownLeft, Monitor, Moon, Search, Sun } from 'lucide-react';
import type { NavGroup } from '@/app.config';
import { cn } from '@/lib/cn';
import { usePreferences } from '@/components/base/providers';
import { Kbd } from '@/components/ui/kbd';

export type Command = { id: string; group: string; label: string; hint?: string; icon: ReactNode; run: () => void };

let opener: (() => void) | null = null;
/** Open the palette from anywhere: the rail's search button, a shortcut in a page. */
export function openCommand() {
  opener?.();
}

/**
 * Every destination and every global action behind one keystroke (⌘K or Ctrl K). Type to filter; the arrow keys
 * move, Enter runs, Escape closes. Matches are ranked by where the query starts, then by order.
 */
export function CommandPalette({ nav }: { /** Every destination the rail offers, one "Go to" each: pass the same groups as the Rail. */ nav: NavGroup[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  // The cursor belongs to one query: typing, or opening afresh, starts it at the top again without an effect.
  const [cursor, setCursor] = useState({ key: '', i: 0 });
  const key = `${open}|${q}`;
  const at = cursor.key === key ? cursor.i : 0;
  const setAt = (next: number | ((i: number) => number)) => setCursor({ key, i: typeof next === 'function' ? next(at) : next });
  const list = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { set } = usePreferences();

  useEffect(() => {
    opener = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      opener = null;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const commands = useMemo<Command[]>(
    () => [
      ...nav.flatMap((g) =>
        g.items.map((it) => {
          const Icon = it.icon;
          return { id: it.href, group: 'Go to', label: it.label, hint: g.label, icon: <Icon />, run: () => router.push(it.href) };
        }),
      ),
      { id: 'theme-light', group: 'Appearance', label: 'Use the light theme', icon: <Sun />, run: () => set({ theme: 'light' }) },
      { id: 'theme-dark', group: 'Appearance', label: 'Use the dark theme', icon: <Moon />, run: () => set({ theme: 'dark' }) },
      { id: 'theme-system', group: 'Appearance', label: 'Follow the system theme', icon: <Monitor />, run: () => set({ theme: 'system' }) },
    ],
    [nav, router, set],
  );

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands;
    return commands
      .map((c, i) => ({ c, i, p: c.label.toLowerCase().indexOf(s) }))
      .filter((x) => x.p >= 0 || (x.c.hint ?? '').toLowerCase().includes(s))
      .sort((a, b) => (a.p < 0 ? 99 : a.p) - (b.p < 0 ? 99 : b.p) || a.i - b.i)
      .map((x) => x.c);
  }, [q, commands]);

  useEffect(() => {
    list.current?.querySelector(`[data-index="${at}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [at]);

  const run = (c?: Command) => {
    if (!c) return;
    setOpen(false);
    setQ('');
    c.run();
  };

  return (
    <D.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(''); }}>
      <D.Portal>
        <D.Overlay className="scrim-in fixed inset-0 z-(--layer-overlay) bg-scrim" />
        <D.Content
          aria-describedby={undefined}
          className="dialog-in fixed top-[14vh] left-1/2 z-(--layer-overlay) w-[min(600px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-xl bg-surface-raised shadow-overlay"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setAt((a) => Math.min(shown.length - 1, a + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setAt((a) => Math.max(0, a - 1)); }
            if (e.key === 'Enter') { e.preventDefault(); run(shown[at]); }
          }}
        >
          <D.Title className="sr-only">Search and commands</D.Title>
          <CommandPanel query={q} onQuery={setQ} commands={shown} at={at} onAt={setAt} onRun={run} listRef={list} autoFocus />
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/**
 * The palette's panel without its dialog: the query, the grouped results and the key hints. The palette wraps it in
 * a dialog; the Atlas renders it inline to show the open state.
 */
export function CommandPanel({
  query,
  onQuery,
  commands,
  at,
  onAt,
  onRun,
  listRef,
  autoFocus,
}: {
  query: string;
  onQuery: (q: string) => void;
  /** The commands to show, already filtered and ranked. */
  commands: Command[];
  /** The highlighted row. */
  at: number;
  onAt: (i: number) => void;
  onRun: (c: Command) => void;
  listRef?: React.Ref<HTMLDivElement>;
  autoFocus?: boolean;
}) {
  let lastGroup = '';
  return (
    <>
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="size-4.5 shrink-0 text-ink-3" strokeWidth={1.75} />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search pages and commands…"
          aria-label="Search pages and commands"
          role="combobox"
          aria-expanded
          aria-controls="cmd-list"
          aria-activedescendant={commands[at] ? `cmd-${commands[at].id}` : undefined}
          className="h-14 min-w-0 flex-1 bg-transparent text-md outline-none placeholder:text-ink-3"
        />
        <Kbd>Esc</Kbd>
      </div>
      <div ref={listRef} id="cmd-list" role="listbox" className="max-h-[min(420px,52vh)] overflow-y-auto p-2">
        {commands.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-ink-3">Nothing matches “{query}”. Try a page name, such as Requests.</p>
        ) : (
          commands.map((c, i) => {
            const head = c.group !== lastGroup ? (lastGroup = c.group) : null;
            return (
              <div key={c.id}>
                {head ? <p className="t-eyebrow px-3 pt-3 pb-1.5 first:pt-1.5">{head}</p> : null}
                <div
                  id={`cmd-${c.id}`}
                  role="option"
                  aria-selected={i === at}
                  data-index={i}
                  onPointerMove={() => onAt(i)}
                  onClick={() => onRun(c)}
                  className={cn(
                    'flex h-10 cursor-default items-center gap-3 rounded-md px-3 text-sm [&_svg]:size-4 [&_svg]:text-ink-3',
                    i === at && 'bg-fill-hover [&_svg]:text-ink-2',
                  )}
                >
                  {c.icon}
                  <span className="flex-1 truncate">{c.label}</span>
                  {c.hint ? <span className="text-xs text-ink-3">{c.hint}</span> : null}
                  {i === at ? <CornerDownLeft className="!size-3.5" /> : <ArrowRight className="!size-3.5 opacity-0" />}
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="flex items-center gap-4 border-t border-line bg-surface-sunk/60 px-4 py-2.5 text-xs text-ink-3">
        <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
        <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> open</span>
        <span className="ml-auto flex items-center gap-1.5 max-sm:hidden"><Kbd>⌘K</Kbd> toggle</span>
      </div>
    </>
  );
}
