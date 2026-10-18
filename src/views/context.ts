/**
 * What every view's shared context is built with (decision 0011): the scope's words, the address with its query, how
 * fresh the read is, and the context of a view whose data has not arrived.
 *
 * Plain functions over plain data, with no hook and nothing a browser or a server lacks: a page calls its view's
 * context function from the browser and the view's tool calls the same one on the server (`src/views/tools.ts`), so
 * the screen and the assistant are told one thing.
 */
import { contextText, freshnessOf, type SharedContext } from '@/lib/shared-context';

/** Whose data a view shows: every team's for a superadmin in the platform view, one team's otherwise. */
type ViewMode = 'platform' | 'team';

/** When a view's data arrived, and the clock that is measured against: the data's, never the browser's at render. */
export type Arrival = { updatedAt: Date | string | null; now: Date | string };

/** The console's own threshold for a stale page, the one its freshness stamp turns at. */
const STALE_AFTER_MS = 10 * 60_000;

export const arrived = ({ updatedAt, now }: Arrival): string => freshnessOf(updatedAt, now, STALE_AFTER_MS);

/** "across every team on the platform" or "for your team": the words the pages' own mastheads use. */
export const whose = (mode: ViewMode): string => (mode === 'platform' ? 'every team on the platform' : 'your team only');

/** A console address with its query, leaving out every parameter still at its default so the link is the short one. */
export function addressOf(path: string, params: Record<string, string | undefined> = {}, defaults: Record<string, string> = {}): string {
  const query = Object.entries(params).filter(([k, v]) => v !== undefined && v !== '' && v !== defaults[k]).map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`);
  return query.length ? `${path}?${query.join('&')}` : path;
}

/**
 * A view with nothing to say yet: its read is still in flight, or it failed. It names the view and says which, so a
 * question asked in that moment is answered "the page has not loaded" rather than from a guess.
 */
export function pendingContext(view: Pick<SharedContext, 'view' | 'title' | 'address' | 'scope'>, failure?: string | null): SharedContext {
  return {
    ...view,
    facts: [],
    insights: [],
    unknowns: [failure ? `This page's data could not be read: ${failure}` : 'This page\'s data has not arrived yet, so no figure on it can be quoted.'],
  };
}

/** The most a view's context may be, as the text a model reads: Meridian's budget for one view (decision 0011). */
export const CONTEXT_BUDGET = 2400;

/** A name or a sentence somebody else wrote, cut to `max` characters: one long slug may not crowd out a figure. */
export const clip = (text: string, max = 64): string => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/**
 * `context` held to its budget, whatever the platform holds. A context is the whole state every turn, so it may not
 * grow with the data: every view lists its insights most important first and its roster of rows last, and what does
 * not fit is dropped from the end, with a line saying the page has more. The figures and their definitions are never
 * dropped; a context that cannot fit them is a context to rewrite.
 */
export function budgeted(context: SharedContext): SharedContext {
  if (contextText(context).length <= CONTEXT_BUDGET) return context;
  const more = `More is on the page than fits here; ${context.address} shows all of it.`;
  const insights = [...context.insights];
  const fit = () => ({ ...context, insights, unknowns: [...context.unknowns, more] });
  while (insights.length && contextText(fit()).length > CONTEXT_BUDGET) insights.pop();
  return fit();
}

/** A share as a whole percent of a total, or nothing when there is no total. */
export const shareOf = (part: number, total: number): string => (total ? `${Math.round((part / total) * 100)}%` : '0%');
