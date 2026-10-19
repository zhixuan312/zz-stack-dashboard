/**
 * A view's shared context: the one account of what a view shows that both agents read (decision 0011). An MCP host gets
 * it through `ui/update-model-context`; the console's assistant gets it with the person's question; a view tool returns
 * it. Plain data, serialisable, safe on the server and in the browser.
 *
 * Every context is the WHOLE state of the view, never a delta: a host keeps only the latest update. The text carries
 * everything, because a host is not required to give the model the structured part.
 */
import { app } from '../app.config';
import type { z } from 'zod';
import { formatDateTime, formatRelative } from './format-date';
import type { Need } from './collection';
import type { PreparedQuery } from './explore';

/** One figure as the screen shows it, with what it counts. */
export type Fact = {
  /** As the screen labels it: "Error rate". */
  label: string;
  /** Formatted with its unit, as the screen shows it: "0.90%". */
  value: string;
  /** The change and what it is measured against: "up 12.4% vs the previous 30 days (0.80%)". */
  change?: string;
  /** What the figure counts, in the product's words: "Share of requests answered with a 5xx or a 429." */
  definition?: string;
};

/** A finding computed by code, with its figures, and where a person can see it for themselves. */
export type Insight = {
  text: string;
  /** The console address that shows the evidence: "/requests?status=5xx". */
  evidence?: string;
};

export type SharedContext = {
  /** A stable name for the view: "home". */
  view: string;
  /** The view's title: "Home". */
  title: string;
  /** The console address that opens this exact view, with its query: "/?period=30d". */
  address: string;
  /** What the figures cover, in words: "last 30 days, 04 Sept 2026 to 03 Oct 2026 (UTC)", or the filters. */
  scope: string;
  /** How fresh the data is, as a sentence: "Data as of 03 Oct 2026, 13:56 UTC, 4 min before now: fresh." */
  freshness?: string;
  /** What the person is pointing at, when anything: a day, a record, a selection. */
  focus?: string;
  facts: Fact[];
  insights: Insight[];
  /** What the data cannot say, stated so nobody fills the gap with a guess. */
  unknowns: string[];
  /**
   * Questions worth asking first about what the view shows, in the person's words: the console's assistant offers them
   * while its thread is empty. They are for the person, so they are never in the text a model is told.
   */
  questions?: string[];
};

/** At most `max` items of a list, joined, and how many more there are: a context never grows with the data. */
export function listed<T>(items: T[], say: (t: T) => string, more: string, max = 25): string {
  const shown = items.slice(0, max).map(say).join('; ');
  return items.length > max ? `${shown}; and ${items.length - max} more (${more})` : shown;
}

/** How the data's age reads: fresh until `staleAfterMs`, as the Freshness pattern draws it. */
export function freshnessOf(updatedAt: Date | string | null, now: Date | string, staleAfterMs = 15 * 60_000): string {
  if (!updatedAt) return 'The data has never been updated.';
  const at = new Date(updatedAt), clock = new Date(now);
  const stale = clock.getTime() - at.getTime() > staleAfterMs;
  const age = formatRelative(at, clock);
  // formatDateTime writes the time in the product's reporting zone, so the label is that zone, never a fixed UTC.
  return `Data as of ${formatDateTime(at)} ${app.timezone} (${age === 'just now' ? 'just now' : age.replace(/ ago$/, ' before now')}): ${stale ? 'STALE, so figures may have moved since; say so before using them' : 'fresh'}.`;
}

/** The context as the model reads it: short labelled lines, the same order every time so turns compare. */
export function contextText(c: SharedContext): string {
  const lines = [`${c.title} · ${c.scope} · address ${c.address}`];
  if (c.freshness) lines.push(c.freshness);
  if (c.focus) lines.push(`The person is pointing at: ${c.focus}`);
  if (c.facts.length) {
    lines.push('Facts:');
    for (const f of c.facts) lines.push(`- ${f.label}: ${f.value}${f.change ? `, ${f.change}` : ''}.${f.definition ? ` (${f.definition.replace(/\.$/, '')}.)` : ''}`);
  }
  if (c.insights.length) {
    lines.push('Insights, computed by the product (quote them; do not recompute):');
    for (const i of c.insights) lines.push(`- ${i.text}${i.evidence ? ` Evidence: ${i.evidence}` : ''}`);
  }
  if (c.unknowns.length) {
    lines.push('Unknown:');
    for (const u of c.unknowns) lines.push(`- ${u}`);
  }
  return lines.join('\n');
}

/**
 * A view's tool: its name, the feature table entry that permits it, the question it answers, the page it renders, its
 * address as input, one read that returns what the view renders (`data`) and what both agents are told (`context`), and
 * the prepared query an agent counts, groups and compares the page's own collections with (`src/lib/explore.ts`), which
 * every view tool declares. The console's assistant offers it as `view_<name>`, and on the page itself the prepared
 * query as `explore_<name>`; an MCP server registers the same contract under its own prefix, with `resourceUri` when the
 * view has an embed (decision 0011). The embed route renders from the same read, so the model's figures and the
 * screen's are one.
 */
export type ViewTool<I extends z.ZodObject = z.ZodObject, D extends object = object> = {
  name: string;
  title: string;
  /** The question the view answers, for the model choosing a tool. */
  description: string;
  /** What a person must be able to do to use the view, taken from its feature entry by reference (`FEATURES.<id>.needs`). */
  needs: Need;
  /**
   * The console route of the page the view renders: a rail destination's `href` in `nav`, or a detail page's route with
   * its segment (`/customers/[id]`, or a catch-all such as `/docs/[...path]`). The assistant finds the view of the page a
   * person is on by it, matched as Next.js matches the route (`viewAt`).
   */
  page: string;
  /** The view's address parameters: the same names as its query string. */
  input: I;
  /** The MCP App to render beside the result, when the view has one: `ui://<slug>/<view>`. */
  resourceUri?: string;
  read: (input: z.infer<I>) => Promise<{ context: SharedContext; data: D }>;
  /**
   * What an agent may count, group and compare over the page's own collections, declared by the page's author beside the
   * view. Every view has one: a question its context does not answer alone is asked of it, and the page's specification
   * lists those questions under "What the agent does here". A detail page's `fixed` is handed the view's own input, so it
   * reads the record the page shows.
   */
  explore: PreparedQuery<z.infer<I>>;
};

/** A view tool, typed from its input schema: `read` receives what `input` parses to. */
export const defineViewTool = <I extends z.ZodObject, D extends object>(tool: ViewTool<I, D>) => tool;

/**
 * How specific each segment of `route` is, as Next.js ranks a route segment: 0 static, 1 `[name]`, 2 `[...name]`, 3
 * `[[...name]]`.
 */
const ranks = (route: string) => segments(route).map((s) => (/^\[\[\.\.\.[^\]/]+\]\]$/.test(s) ? 3 : /^\[\.\.\.[^\]/]+\]$/.test(s) ? 2 : /^\[[^\]/]+\]$/.test(s) ? 1 : 0));

/** An address's segments after the root: `/` has none. */
const segments = (address: string) => (address === '/' ? [''] : address.split('/'));

/**
 * Whether `path`, an address without its query and trailing slash, is one `route` renders, matched the way Next.js
 * matches it: a static segment is itself, `[name]` is any one segment, `[...name]` one or more and `[[...name]]` zero or
 * more of the segments left. A catch-all is the last segment of a route, as Next.js requires.
 */
function rendersAt(route: string, path: string): boolean {
  const want = segments(route), got = segments(path), rank = ranks(route);
  const last = want.length - 1;
  // The segments before a catch-all are matched one for one; the catch-all takes every segment left.
  const fixed = rank[last] >= 2 ? last : want.length;
  const fewest = rank[last] === 3 ? last : want.length;
  if (got.length < fewest || (fixed === want.length && got.length !== want.length)) return false;
  return got.every((s, i) => (i >= fixed || rank[i] ? s !== '' : s === want[i]));
}

/**
 * The view whose `page` renders `path`. Where several do, the one Next.js would render: at the first segment where two
 * routes differ, a static segment wins over `[name]`, `[name]` over `[...name]` and that over `[[...name]]`; two views
 * on one route are the first declared.
 */
export function viewAt<V extends { page: string }>(views: readonly V[], path: string): V | undefined {
  const order = (a: number[], b: number[]) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
    return a.length - b.length;
  };
  return views.filter((v) => rendersAt(v.page, path)).sort((a, b) => order(ranks(a.page), ranks(b.page)))[0];
}
