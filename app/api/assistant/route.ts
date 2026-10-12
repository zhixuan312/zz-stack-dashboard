import { safeValidateUIMessages } from 'ai';
import { revalidateTag } from 'next/cache';
import { assistantConfig } from '@/lib/assistant/config';
import { clock, collections } from '@/data/collections';
import { Unauthenticated, can, collectionFor, may, nameOf, resolveAccess } from '@/data/access';
import { collectionTag } from '@/data/read';
import { respond } from '@/lib/assistant/respond';
import { handedTo } from '@/lib/assistant/scoped';
import type { AgentChange } from '@/lib/assistant/tools';
import type { AnyCollection } from '@/lib/collection';
import type { ViewTool } from '@/lib/shared-context';
import { viewTools } from '@/views/tools';

/** The panel sends at most the last 100 messages; a larger body than 2 MB is refused before it is parsed. */
const MAX_MESSAGES = 100;
const MAX_BODY = 2_000_000;

/** `POST /api/assistant`: answers about the page the person is on. 401 without a session, 404 until the `ASSISTANT_*` variables are set. */
export async function POST(request: Request): Promise<Response> {
  const scope = await resolveAccess().catch((e: unknown) => { if (e instanceof Unauthenticated) return null; throw e; });
  if (!scope) return new Response(null, { status: 401 });
  const config = assistantConfig(process.env);
  if (!config) return new Response(null, { status: 404 });

  const raw = await request.text();
  if (raw.length > MAX_BODY) return new Response(null, { status: 413 });
  const body: unknown = (() => { try { return JSON.parse(raw); } catch { return null; } })();
  const { messages, page } = (body ?? {}) as { messages?: unknown; page?: { path?: unknown; title?: unknown; context?: unknown; text?: unknown } };
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return new Response(null, { status: 400 });
  const valid = await safeValidateUIMessages({ messages });
  if (!valid.success) return new Response(null, { status: 400 });

  // The assistant is handed this caller's own collections, only those they may read, and of those only the operations
  // they may perform, each through `scopedQuery` so its `query` re-checks the person it was handed to at the moment it
  // runs — the same tenant and subject, still permitted to read. Listing a tool is not enforcement: the checks that stop
  // a read or a write are the ones that run at execution.
  const readable = (await Promise.all(collections.map(async (c) => {
    if (!(await can(scope, c.name, 'read'))) return null;
    // `handedTo` is where the order lives: the query re-check, then the operations this person may not perform left off.
    return await handedTo(scope, collectionFor(scope, c.name), c.name);
  }))).filter((c): c is AnyCollection => c !== null);

  // A view tool is registered only where the person satisfies its feature's need. A view's `read` asks the need again,
  // so filtering the list is presentation, not the gate; both stay.
  const views = (await Promise.all(viewTools.map(async (v) => ((await may(v.needs)) ? v : null)))).filter((v): v is ViewTool => v !== null);

  const guard = {
    authorize: async (name: string, op: 'create' | 'update' | 'remove', ids?: string[]) => {
      const now = await resolveAccess().catch(() => null);
      // The same person of the same tenant, still permitted: a session that changed hands since the approval is refused.
      return now !== null && now.tenantId === scope.tenantId && now.subjectId === scope.subjectId && can(now, name, op, ids);
    },
    invalidate: (name: string) => revalidateTag(collectionTag(scope.tenantId, name), { expire: 0 }),
    // Provenance (decision 0011): an approved change leaves an Activity line naming the agent and the person it acted
    // for. Only where the product keeps activity and the person may add to it; the change stands either way.
    record: async (change: AgentChange) => {
      if (!(await can(scope, 'activity', 'create'))) return;
      await collectionFor(scope, 'activity').create!({ at: clock().toISOString(), actor: (await nameOf(scope)) ?? 'You', via: 'Assistant', ...activityLine(change) });
      revalidateTag(collectionTag(scope.tenantId, 'activity'), { expire: 0 });
    },
  };

  return respond({
    ...config,
    collections: readable,
    // Every view tool this caller may use; each reads through `read()`, so it sees only what this caller may read.
    views,
    guard,
    now: clock(),
    messages: valid.data,
    page: { path: String(page?.path ?? ''), title: String(page?.title ?? ''), context: String(page?.context ?? ''), text: String(page?.text ?? '') },
  });
}

/** An agent's change as an Activity line: "changed status to Suspended for Alice Moreno and Ravi Patel". */
function activityLine({ label, op, titles, set }: AgentChange): { verb: string; object: string } {
  const names = titles.length <= 3 ? titles.join(titles.length === 2 ? ' and ' : ', ') : `${titles.length} ${label.toLowerCase()}`;
  if (op === 'create') return { verb: 'added', object: `${names} to ${label.toLowerCase()}` };
  if (op === 'remove') return { verb: 'removed', object: `${names} from ${label.toLowerCase()}` };
  const fields = Object.entries(set ?? {}).map(([k, v]) => `${k} to ${Array.isArray(v) ? v.join(', ') : String(v)}`).join(', ');
  return { verb: 'changed', object: `${fields} for ${names}` };
}
