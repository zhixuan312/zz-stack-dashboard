/**
 * What every view's shared context is built with (decision 0011): the scope's words, the address with its query, how
 * fresh the read is, how long a read may take, and the context of a view whose data has not arrived.
 *
 * Plain functions over plain data, with no hook and nothing a browser or a server lacks: a page calls its view's
 * context function from the browser and the view's tool calls the same one on the server (`src/views/tools.ts`), so
 * the screen and the assistant are told one thing.
 */
import { contextText, freshnessOf, type Insight, type SharedContext } from '@/lib/shared-context';

/** Whose data a view shows: every team's for a superadmin in the platform view, one team's otherwise. */
type ViewMode = 'platform' | 'team';

/** When a view's data arrived, and the clock that is measured against: the data's, never the browser's at render. */
export type Arrival = { updatedAt: Date | string | null; now: Date | string };

/**
 * How long any read of the console's may go unanswered, from the moment it is sent, before its page says so: half a
 * second under the spec's five, which is what the phone profile takes to draw that state, so a person sees it within
 * five seconds of the read (spec AC-8.7; measured 111 to 255 ms on 2026-10-14). One bound for every read: each page's
 * first read on the console's server, the browser's later reads (`src/lib/api.ts`) and the identity read
 * (`src/data/gateway.ts`) all take it from here, so none drifts from the others. COUPLED: `scripts/primary-data.ts`
 * holds the screen to five seconds with no allowance.
 */
export const READ_BOUND_MS = 4_500;

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

/** The most a view's context may be, as the text a model reads: ZZ Meridian's budget for one view (2,600 characters
 *  since its 0.15.0, the cap `src/lib/assistant/prompt.ts` enforces). */
export const CONTEXT_BUDGET = 2600;

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

/** A part of a page its context tells: the name the page gives it, and its rows as the assistant is told them; null for
 *  a part the page draws and the context never tells, such as a heatmap, whose cells are no rows a sentence names. */
export type Section = { name: string; insight: Insight | null };

/**
 * `context` with the sections of its page, the most important first: each section's rows where they fit the budget
 * beside those before it, and every section left out, for the budget or because the page alone draws it, named in one
 * line of the Unknown. `budgeted` alone drops what does not fit with one line saying only that the page has more, which
 * left an agent not knowing which part it was not told (Phase 7's third re-review, Work P-2 and Platform P-1). A long
 * section the budget cannot hold costs only itself: a shorter one after it is still told. Here, beside `budgeted`, so
 * every view that sections its page loads it from the module every route already loads.
 */
export function sectioned(context: SharedContext, sections: Section[]): SharedContext {
  const fit = (told: Section[]): SharedContext => {
    const left = sections.filter((s) => !told.includes(s)).map((s) => s.name);
    const only = left.length ? [`On the page only: ${left.join('; ')}; ${context.address} draws ${left.length === 1 ? 'it' : 'them'}.`] : [];
    return { ...context, insights: [...context.insights, ...told.map((s) => s.insight!)], unknowns: [...context.unknowns, ...only] };
  };
  const told: Section[] = [];
  for (const s of sections) if (s.insight && contextText(fit([...told, s])).length <= CONTEXT_BUDGET) told.push(s);
  return budgeted(fit(told));
}
