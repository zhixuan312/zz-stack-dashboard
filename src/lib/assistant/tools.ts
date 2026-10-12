import { tool, type SingleToolApprovalFunction, type ToolSet, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import { patchOf, queryInput, writableFields, type AnyCollection } from '@/lib/collection';
import { contextText, type ViewTool } from '@/lib/shared-context';

type Row = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rule = SingleToolApprovalFunction<any, any, any>;
type Change = { label: string; from: string; to: string };

const text = (v: unknown) => (v === null || v === undefined ? '—' : Array.isArray(v) ? v.join(', ') : String(v));
/**
 * The tool calls that have run in this process. An approval is signed, but the same approved call sent again would
 * run again; each call id runs once.
 */
const APPLIED = Symbol.for('zz-meridian.assistant.applied');
const applied = () => ((globalThis as Record<symbol, unknown>)[APPLIED] ??= new Set<string>()) as Set<string>;
async function once<R>(toolCallId: string, run: () => Promise<R>): Promise<R> {
  if (applied().has(toolCallId)) throw new ChangeRefused('This change was already applied.');
  applied().add(toolCallId);
  try {
    return await run();
  } catch (e) {
    throw new ChangeRefused(e instanceof z.ZodError ? `The change does not fit: ${e.issues.map((i) => `${i.path.join('.') || 'record'} ${i.message.toLowerCase()}`).join('; ')}.` : e instanceof Error ? e.message : 'The change did not go through.');
  }
}

/**
 * What an approved change must ask again at the moment it runs: whether the caller still may make it, with the records
 * it touches, and a way to drop the collection's cached reads once it has committed.
 */
export type Guard = {
  authorize: (name: string, op: 'create' | 'update' | 'remove', ids?: string[]) => Promise<boolean>;
  invalidate: (name: string) => void;
  /**
   * Told after a change commits, so the product can keep a record of what an agent did and for whom (an Activity line,
   * an audit table). Optional: without it nothing is recorded. A failure here is logged and never undoes the change.
   */
  record?: (change: AgentChange) => Promise<void> | void;
};

/** A change an agent made, as a record of it needs: which collection, what kind, the records by title, and what was set. */
export type AgentChange = { name: string; label: string; op: 'create' | 'update' | 'remove'; titles: string[]; set?: Record<string, unknown> };

/** A change the collection or the run-once rule refused. Its reason is the person's to read, so it is shown as it is. */
export class ChangeRefused extends Error {}
/** "API keys" stays, "Members" becomes "members". */
const lower = (label: string) => (/^.[A-Z]/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1));

/**
 * The assistant's tools for `collections`, and the rule that holds every change for the person's approval.
 * A rule writes the server's preview of the change to `writer` before the approval request goes out. An approval is
 * only the person's consent: each execution asks `guard` again before it mutates, so a permission revoked since the
 * approval refuses the change, and invalidates the collection after it commits.
 *
 * `views` adds one read-only `view_<name>` tool per view (decision 0011): it opens the view at an address and returns
 * its shared context, the same text the page tells the assistant, so the assistant can look at another period, filter
 * or record without the person navigating. A view tool changes nothing and needs no approval.
 */
export function assistantTools(collections: AnyCollection[], writer: UIMessageStreamWriter, guard: Guard, views: ViewTool[] = []): { tools: ToolSet; toolApproval: Record<string, Rule> } {
  const tools: ToolSet = {};
  const toolApproval: Record<string, Rule> = {};

  for (const v of views) {
    tools[`view_${v.name}`] = tool({
      description: `Open the ${v.title} view at an address and read what it shows: ${v.description} Returns its shared context: figures with units and definitions, what the product computed from them, what is unknown, and the console address that shows it to the person.`,
      inputSchema: v.input,
      execute: async (input) => {
        const { context } = await v.read(input);
        return { address: context.address, context: contextText(context) };
      },
    });
  }

  for (const c of collections) {
    const hidden = (c.hidden ?? []) as string[];
    const strip = (r: Row) => Object.fromEntries(Object.entries(r).filter(([k]) => !hidden.includes(k)));
    const allowed = (op: 'create' | 'update' | 'remove') => c[op] && !c.pageOnly?.includes(op);
    // What an agent may write: the visible fields minus the fields only a page may set (`pageOnlyFields`). Both the
    // create schema and the update tool's `set` come from this, so a page-only field is absent from the schema and —
    // because the schema is strict — refused at execution if a call names it anyway.
    const fields = writableFields(c);

    tools[`query_${c.name}`] = tool({
      description: `Look up ${c.label.toLowerCase()}: ${c.description} A field with no value matches only ne.`,
      inputSchema: queryInput(c),
      execute: async (input) => {
        const { rows, total } = await c.query(input);
        return { rows: rows.map(strip), total };
      },
    });

    /** The rows for `ids` in the order asked, or the ids the collection does not have. */
    const find = async (asked: string[]): Promise<{ rows: Row[] } | { missing: string[] }> => {
      const ids = [...new Set(asked)];
      const { rows } = await c.query({ where: [{ field: c.key, op: 'in', value: ids }] });
      const byId = new Map<string, Row>(rows.map((r: Row) => [String(r[c.key]), r]));
      const missing = ids.filter((id) => !byId.has(id));
      return missing.length ? { missing } : { rows: ids.map((id) => byId.get(id)!) };
    };
    const propose = (id: string, title: string, tone: 'neutral' | 'critical', changes: Change[]) => {
      writer.write({ type: 'data-proposal', id, data: { title, tone, changes } });
      return 'user-approval' as const;
    };
    /**
     * Runs `change` only while the caller may still make it; a refusal writes nothing, emits nothing and invalidates
     * nothing. Once it commits, the guard is told what changed, by the records' titles, so the product can record it.
     */
    const guarded = async <R>(op: 'create' | 'update' | 'remove', ids: string[] | undefined, change: () => Promise<R>, record: { titles: string[]; set?: Row }): Promise<R> => {
      if (!(await guard.authorize(c.name, op, ids))) throw new ChangeRefused('You no longer have permission to make this change.');
      const result = await change();
      guard.invalidate(c.name);
      try {
        await guard.record?.({ name: c.name, label: c.label, op, ...record });
      } catch (e) {
        console.error('assistant: the change applied but could not be recorded', e);
      }
      return result;
    };
    /** The titles of the records `ids` names, read before a change alters or removes them. */
    const titlesOf = async (ids: string[]) => { const found = await find(ids); return 'rows' in found ? found.rows.map((r) => c.title(r)) : ids; };
    const what = (rows: Row[]) => (rows.length === 1 ? c.title(rows[0]) : `${rows.length} ${lower(c.label)}`);

    if (allowed('create')) {
      tools[`create_${c.name}`] = tool({
        description: `Add a record to ${c.label.toLowerCase()}.`,
        inputSchema: fields,
        execute: (input, { toolCallId }) => once(toolCallId, () => guarded('create', undefined, async () => strip(await c.create!(input)), { titles: [c.title(input)] })),
      });
      toolApproval[`create_${c.name}`] = ((input: Row, { toolCallId }) =>
        propose(toolCallId, `Add ${c.title(input)}`, 'neutral', Object.entries(input).map(([label, v]) => ({ label, from: '—', to: text(v) })))) as Rule;
    }

    if (allowed('update')) {
      tools[`update_${c.name}`] = tool({
        description: `Change fields on one or more ${c.label.toLowerCase()} by id.`,
        inputSchema: z.object({ ids: z.array(z.string()).min(1), set: patchOf(fields).refine((set) => Object.keys(set).length > 0, 'Name at least one field to change.') }),
        execute: ({ ids, set }, { toolCallId }) => once(toolCallId, async () => guarded('update', [...new Set(ids)], async () => (await c.update!([...new Set(ids)], set)).map(strip), { titles: await titlesOf([...new Set(ids)]), set })),
      });
      toolApproval[`update_${c.name}`] = (async ({ ids, set }: { ids: string[]; set: Row }, { toolCallId }) => {
        const found = await find(ids);
        if ('missing' in found) return { type: 'denied', reason: `No such id: ${found.missing.join(', ')}` };
        const keys = Object.keys(set);
        const changes = found.rows.flatMap((row) => keys.map((k) => ({ label: keys.length === 1 ? c.title(row) : `${c.title(row)} · ${k}`, from: text(row[k]), to: text(set[k]) })));
        return propose(toolCallId, `Change ${what(found.rows)}`, 'neutral', changes);
      }) as Rule;
    }

    if (allowed('remove')) {
      tools[`remove_${c.name}`] = tool({
        description: `Remove one or more ${c.label.toLowerCase()} by id.`,
        inputSchema: z.object({ ids: z.array(z.string()).min(1) }),
        execute: ({ ids }, { toolCallId }) => once(toolCallId, async () => guarded('remove', [...new Set(ids)], () => c.remove!([...new Set(ids)]), { titles: await titlesOf([...new Set(ids)]) })),
      });
      toolApproval[`remove_${c.name}`] = (async ({ ids }: { ids: string[] }, { toolCallId }) => {
        const found = await find(ids);
        if ('missing' in found) return { type: 'denied', reason: `No such id: ${found.missing.join(', ')}` };
        return propose(toolCallId, `Remove ${what(found.rows)}`, 'critical', found.rows.map((row) => ({ label: c.title(row), from: c.label, to: 'Removed' })));
      }) as Rule;
    }
  }
  return { tools, toolApproval };
}
