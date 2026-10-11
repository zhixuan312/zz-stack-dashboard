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
  /** A stable name for the view: "overview". */
  view: string;
  /** The view's title: "Overview". */
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
 * A view's tool: its name, the feature table entry that permits it, the question it answers, its address as input, and
 * one read that returns what the view renders (`data`) and what both agents are told (`context`). The console's
 * assistant offers it as `view_<name>`; an MCP server registers the same contract under its own prefix, with
 * `resourceUri` when the view has an embed (decision 0011). The embed route renders from the same read, so the model's
 * figures and the screen's are one.
 */
export type ViewTool<I extends z.ZodObject = z.ZodObject, D extends object = object> = {
  name: string;
  title: string;
  /** The question the view answers, for the model choosing a tool. */
  description: string;
  /** What a person must be able to do to use the view, taken from its feature entry by reference (`FEATURES.<id>.needs`). */
  needs: Need;
  /** The view's address parameters: the same names as its query string. */
  input: I;
  /** The MCP App to render beside the result, when the view has one: `ui://<slug>/<view>`. */
  resourceUri?: string;
  read: (input: z.infer<I>) => Promise<{ context: SharedContext; data: D }>;
};

/** A view tool, typed from its input schema: `read` receives what `input` parses to. */
export const defineViewTool = <I extends z.ZodObject, D extends object>(tool: ViewTool<I, D>) => tool;
