'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { app } from '../../../app.config';
import { HostBridge, type DisplayMode, type HostContext } from '../../../lib/host';
import { toast } from '../../ui/toast/index';

/**
 * Which surface a view is on, and what it may ask of its host. Components read `useSurface()` and never touch the
 * bridge: on the console every agent affordance is absent; in an MCP host they act through it.
 */
export type Surface = {
  kind: 'console' | 'embed';
  /** A host answered `ui/initialize`. An embed opened directly (in the Atlas, in a tab) is not connected. */
  connected: boolean;
  mode: DisplayMode;
  host: HostContext;
  /** Ask for fullscreen; when the host refuses, open the console instead. */
  expand: (consolePath: string) => void;
  /** Post a question into the conversation, as the person. Absent when no agent is listening. */
  ask?: (text: string) => void;
  /** Call one of the product's tools through the host (an approved proposal's apply). Absent when not connected. */
  callTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  /** Tell the agent what is on screen: the host's model in an embed, the console's assistant on the console. */
  share: (text: string, structured?: object) => void;
  openLink: (url: string) => void;
};

/** The context the console's view on screen last shared, and the path it was shared on (decision 0011). */
let published: { path: string; text: string } | null = null;
/** What the console's assistant reads with a question: the shared context of the view on `path`, or `null` when that page shares none. */
export const sharedContextOn = (path: string): string | null => (published?.path === path ? published.text : null);

const CONSOLE: Surface = {
  kind: 'console',
  connected: false,
  mode: 'fullscreen',
  host: {},
  expand: (p) => { window.location.href = p; },
  share: (text) => { published = { path: window.location.pathname, text }; },
  openLink: (u) => { window.open(u, '_blank', 'noopener'); },
};

const Ctx = createContext<Surface>(CONSOLE);
export const useSurface = () => useContext(Ctx);

/**
 * The console, with `ask` when the shell has an assistant to hand a card to: Ask on a card opens the panel and posts
 * the question as the person, and the view's shared context goes with it. Without an assistant, `ask` is absent and
 * every Ask renders nothing (decision 0004: no dead control).
 */
export function ConsoleSurface({ ask, children }: { ask?: (text: string) => void; children: ReactNode }) {
  const value = useMemo<Surface>(() => ({ ...CONSOLE, ask }), [ask]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Put a subtree on a given surface without a host: the Atlas's previews and the tests use it to show an embed in
 * inline or fullscreen mode, connected or not. Products never need it. A preview shares with nobody unless `share` is
 * given: an Atlas page full of specimens must not tell the assistant it is looking at one of them.
 */
export function SurfaceOverride({ surface, children }: { surface: Partial<Surface>; children: ReactNode }) {
  const base = useContext(Ctx);
  return <Ctx.Provider value={{ ...base, share: () => {}, ...surface }}>{children}</Ctx.Provider>;
}

/** The embed surface: starts the host bridge, applies the host's theme and style variables, and reports its height. */
export function EmbedSurface({ children }: { children: ReactNode }) {
  const bridge = useRef<HostBridge | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HostContext>({});
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState<DisplayMode>('inline');
  // The first line of the context last shared (the view, its scope and its address), and whether the host refused it:
  // then Ask carries that line, so the question keeps its referent even though the model was never told the view.
  const shared = useRef<{ head: string; refused: boolean }>({ head: '', refused: false });

  useEffect(() => {
    const d = document.documentElement;
    d.setAttribute('data-surface', 'embed');
    const sys = matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = (t?: 'light' | 'dark') => d.setAttribute('data-theme', t ?? (sys.matches ? 'dark' : 'light'));
    applyTheme();
    if (!HostBridge.framed()) return () => d.removeAttribute('data-surface');
    const b = new HostBridge();
    bridge.current = b;
    const apply = (ctx: HostContext) => {
      setHost(ctx);
      applyTheme(ctx.theme);
      if (ctx.displayMode) setMode(ctx.displayMode);
      d.setAttribute('data-display-mode', ctx.displayMode ?? 'inline');
      if (ctx.platform) d.setAttribute('data-platform', ctx.platform);
      for (const [k, v] of Object.entries(ctx.styles?.variables ?? {})) if (k.startsWith('--') && v) d.style.setProperty(k, v);
      const s = ctx.safeAreaInsets;
      if (s) for (const side of ['top', 'right', 'bottom', 'left'] as const) d.style.setProperty(`--safe-${side}`, `${s[side]}px`);
    };
    const off = b.onContext(apply);
    b.initialize(app.name, '1.0.0').then(() => setConnected(true)).catch(() => setConnected(false));
    return () => { off(); b.dispose(); bridge.current = null; d.removeAttribute('data-surface'); };
  }, []);

  /* Report the body's height whenever it changes: an inline view never scrolls inside the host. */
  useEffect(() => {
    const el = root.current;
    if (!el || !connected) return;
    const ro = new ResizeObserver(() => bridge.current?.sizeChanged(Math.ceil(el.scrollWidth), Math.ceil(el.scrollHeight)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [connected]);

  const value = useMemo<Surface>(() => {
    // The bridge is read when a call happens, never during render: `connected` only turns true once it exists.
    const bridgeOf = () => (connected ? bridge.current : null);
    return {
      kind: 'embed',
      connected,
      mode,
      host,
      expand: (p) => {
        const b = bridgeOf();
        if (!b) return void window.open(p, '_blank', 'noopener');
        b.requestDisplayMode('fullscreen').then((r) => r.mode === 'fullscreen' ? setMode('fullscreen') : b.openLink(new URL(p, location.origin).href)).catch(() => b.openLink(new URL(p, location.origin).href));
      },
      ask: connected
        ? (text) => {
            const q = shared.current.refused && shared.current.head ? `${text} (${shared.current.head})` : text;
            void bridgeOf()?.message(q).catch(() => toast({ tone: 'neutral', title: 'The chat did not take the question', description: `Ask it there: "${text}"` }));
          }
        : undefined,
      callTool: connected ? (name, args) => bridgeOf()!.callTool(name, args) : undefined,
      share: (text, structured) => {
        const b = bridgeOf();
        if (!b) return;
        const entry = { head: text.split('\n')[0], refused: false };
        shared.current = entry;
        // A refused update is tried once more; if the host refuses again, Ask carries the view's first line instead.
        const send = () => b.modelContext(text, structured);
        void send().catch(() => new Promise((r) => setTimeout(r, 1000)).then(send)).catch(() => { entry.refused = true; });
      },
      openLink: (u) => {
        const b = bridgeOf();
        return b ? void b.openLink(new URL(u, location.origin).href) : void window.open(u, '_blank', 'noopener');
      },
    };
  }, [connected, mode, host]);

  return (
    <Ctx.Provider value={value}>
      <div
        ref={root}
        data-mode={mode}
        className="pt-[var(--safe-top,0px)] pr-[var(--safe-right,0px)] pb-[var(--safe-bottom,0px)] pl-[var(--safe-left,0px)]"
      >
        {children}
      </div>
    </Ctx.Provider>
  );
}
