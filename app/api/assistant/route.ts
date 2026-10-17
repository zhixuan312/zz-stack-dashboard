import { safeValidateUIMessages } from 'ai';
import { revalidateTag } from 'next/cache';
import { nav, refusal } from '@/app.config';
import { assistantConfig } from '@/lib/assistant/config';
import { clock, collections } from '@/data/collections';
import { Unauthenticated, can, collectionFor, may, resolveAccess } from '@/data/access';
import { FLEET } from '@/data/features';
import { FLEET_FIELDS, PREPARED } from '@/data/prepared';
import { aggregate, collectionTag, read } from '@/data/read';
import { MAIN_ROLES, whoCan } from '@/data/roles';
import { respond } from '@/lib/assistant/respond';
import { handedTo } from '@/lib/assistant/scoped';
import type { HandedExplore } from '@/lib/assistant/tools';
import type { AnyCollection } from '@/lib/collection';
import type { PreparedQuery } from '@/lib/explore';
import { dayOf } from '@/lib/format-date';
import { viewAt, type ViewTool } from '@/lib/shared-context';
import { viewTools } from '@/views/tools';

/** The panel sends at most the last 100 messages; a larger body than 2 MB is refused before it is parsed. */
const MAX_MESSAGES = 100;
const MAX_BODY = 2_000_000;

/**
 * `POST /api/assistant`: answers about the page the person is on. 401 without a session, 404 until the `ASSISTANT_*`
 * variables are set, 409 when the thread was started for another person or for the team they acted for before.
 */
export async function POST(request: Request): Promise<Response> {
  const scope = await resolveAccess().catch((e: unknown) => { if (e instanceof Unauthenticated) return null; throw e; });
  if (!scope) return new Response(null, { status: 401 });
  const config = assistantConfig(process.env);
  if (!config) return new Response(null, { status: 404 });

  const raw = await request.text();
  if (raw.length > MAX_BODY) return new Response(null, { status: 413 });
  const body: unknown = (() => { try { return JSON.parse(raw); } catch { return null; } })();
  const { messages, page, scope: started } = (body ?? {}) as { messages?: unknown; page?: { path?: unknown; title?: unknown; context?: unknown; text?: unknown }; scope?: unknown };
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return new Response(null, { status: 400 });
  // The panel names the scope its thread was started for: the team acted for and the person (`AssistantScope` in the
  // layout). A thread of another person, or of this person for another team, is never answered for this one: nothing
  // of it reaches the model, and the panel clears it on the 409.
  if (started !== undefined && started !== `${scope.tenantId}/${scope.subjectId}`) {
    return new Response('You are signed in as someone else now, or act for another team, so the earlier conversation was cleared. Ask again.', { status: 409, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  const valid = await safeValidateUIMessages({ messages });
  if (!valid.success) return new Response(null, { status: 400 });

  // This caller's own collections, only those they may read, and of those only the operations they may perform. The
  // assistant reads none of them directly: it reads through the view tools and the page's prepared query, which ask the
  // grant again when they run. Listing a tool is not enforcement: the checks that stop a read are the ones that run at
  // execution.
  const readable = (await Promise.all(collections.map(async (c) => {
    if (!(await can(scope, c.name, 'read'))) return null;
    return await handedTo(scope, collectionFor(scope, c.name), c.name);
  }))).filter((c): c is AnyCollection => c !== null);

  // A view tool is registered only where the person satisfies its feature's need. A view's `read` asks the need again,
  // so filtering the list is presentation, not the gate; both stay.
  const views = (await Promise.all(viewTools.map(async (v) => ((await may(v.needs)) ? v : null)))).filter((v): v is ViewTool => v !== null);

  // The prepared query of the page the person is on, and no other page's: the view whose page the address is, where
  // they may use it. It reads through `aggregate()` and `read()`, which ask the person's grant again when a call runs;
  // its schema offers only what they may read: the collections handed above, without the dimensions only a superadmin
  // may name, which the gateway refuses anyone else.
  const path = pathOf(String(page?.path ?? ''));
  const at = viewAt(viewTools, path);
  const view = at && views.includes(at) ? at : undefined;
  const names = new Set(readable.map((c) => c.name));
  const reads = new Set(view ? Object.values(view.explore.sources).map((s) => s.collection) : []);
  const wide = await may(FLEET);
  const explore: HandedExplore | undefined = view && [...reads].some((name) => names.has(name))
    ? {
      view,
      rights: { readable: names, hidden: (name) => [...((readable.find((c) => c.name === name)?.hidden ?? []) as string[]), ...(wide ? [] : FLEET_FIELDS[name] ?? [])] },
      io: { aggregate, read, today: dayOf(clock()) },
      page: path,
    }
    : undefined;

  // What the prompt says is true of this person. The addresses are the rail's destinations whose need they satisfy, the
  // predicate `chromeAccess().only` draws the rail by, and the detail pages of the views they may use. Under
  // `refusal: 'explain'` it also names each collection they may not read, the roles that can, every page whose prepared
  // query reads it, with whether this person may open that page, and the figures worked out from it. Under `absent` it
  // names none, as the page names nothing.
  const open = (await Promise.all(nav.flatMap((g) => g.items).map(async (i) => ((await may(i.needs)) ? [i] : [])))).flat();
  const audience = {
    addresses: [
      ...open.filter((i, n) => open.findIndex((o) => o.href === i.href) === n).map((i) => ({ label: i.label, address: i.href })),
      ...views.filter((v) => /\[[^\]/]+\]/.test(v.page)).map((v) => ({ label: v.title, address: v.page.replace(/\[([^\]/]+)\]/g, '<$1>') })),
    ],
    withheld: refusal === 'explain'
      ? PREPARED.filter((r) => !names.has(r.name)).map((r) => {
        const holding = viewTools.filter((v) => Object.values(v.explore.sources).some((s) => s.collection === r.name));
        const pages = holding.map((v) => ({ label: v.title, address: v.page.replace(/\[([^\]/]+)\]/g, '<$1>'), open: views.includes(v) }));
        const derived = [...new Set(holding.flatMap((v) => workedFrom(v.explore, r.name)))];
        return { label: r.label, roles: r.needs === 'public' ? [...MAIN_ROLES] : whoCan(r.needs), ...(pages.length ? { pages } : {}), ...(derived.length ? { derived } : {}) };
      })
      : undefined,
  };

  // No collection takes a change from an agent, so nothing is recorded; the guard still stands for any that ever does.
  const guard = {
    authorize: async (name: string, op: 'create' | 'update' | 'remove', ids?: string[]) => {
      const now = await resolveAccess().catch(() => null);
      // The same person of the same tenant, still permitted: a session that changed hands since the approval is refused.
      return now !== null && now.tenantId === scope.tenantId && now.subjectId === scope.subjectId && can(now, name, op, ids);
    },
    invalidate: (name: string) => revalidateTag(collectionTag(scope.tenantId, name), { expire: 0 }),
  };

  return respond({
    ...config,
    // The write tools are those of the collections the page's prepared query reads, so a page offers the changes of what
    // it shows; none of this console's collections takes one. The limits are said over every collection the person may
    // read, so the assistant can still say why a change is not one it can make.
    collections: readable.filter((c) => reads.has(c.name)),
    readable,
    // Every view tool this caller may use; each reads as this caller, so it sees only what this caller may read.
    views,
    explore,
    guard,
    audience,
    now: clock(),
    messages: valid.data,
    page: { path: String(page?.path ?? ''), title: String(page?.title ?? ''), context: String(page?.context ?? ''), text: String(page?.text ?? '') },
  });
}

/** The address the panel sends without its query or fragment, and without a trailing slash: `/runs?skill=x` is `/runs`. */
function pathOf(address: string): string {
  const path = address.split(/[?#]/)[0];
  return (path.length > 1 ? path.replace(/\/+$/, '') : path) || '/';
}

/**
 * The labels of the derived measures of `query` that read a source over `collection`, directly or through another
 * derived measure: Status's malformed calls per 1,000 are worked out from the platform's calls. A reference
 * `<source>.<measure>` names a measure of another source, as the runner reads it.
 */
function workedFrom(query: PreparedQuery<never>, collection: string): string[] {
  const reads = (source: string, measure: string, seen: string[] = []): boolean => {
    const s = query.sources[source];
    const m = s?.measures[measure];
    if (!m || seen.includes(`${source}.${measure}`)) return false;
    if (!('derive' in m)) return s.collection === collection;
    return m.of.some((ref) => {
      const dot = ref.indexOf('.');
      const [src, name] = dot > 0 && query.sources[ref.slice(0, dot)] ? [ref.slice(0, dot), ref.slice(dot + 1)] : [source, ref];
      return reads(src, name, [...seen, `${source}.${measure}`]);
    });
  };
  return Object.entries(query.sources).flatMap(([source, s]) => Object.entries(s.measures).filter(([name, m]) => 'derive' in m && reads(source, name)).map(([, m]) => m.label));
}
