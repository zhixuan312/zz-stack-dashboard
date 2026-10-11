/* eslint-disable @typescript-eslint/no-explicit-any -- a fake model answers whatever JSON a client sends; this file runs in Node, never in a page. */
/**
 * An OpenAI-compatible fake LLM for tests and local runs. It never touches the network.
 *
 *   node scripts/fake-llm.ts --port <n>     (--port 0 picks a free port)
 *
 * or, from a test: `const llm = await startFakeLlm({ port: 0 })` -> { url, requests, close }.
 *
 * POST <url>/chat/completions answers in the chat-completions format (streamed as server-sent events when the body has
 * `stream: true`). GET <url>/requests returns every recorded request body as JSON.
 *
 * A request whose last message is the user's and contains "fail" is answered 401, with an error body that repeats the
 * bearer token it was sent: the way a provider that refuses a key can leak it.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';

type Message = { role?: string; content?: unknown };
type Call = { name: string; args: object };
type Reply = { text: string } | { calls: Call[] };

const textOf = (content: unknown): string =>
  typeof content === 'string' ? content : Array.isArray(content) ? content.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('') : '';

/** The rows each tool result in the history returned, newest result first. */
function rowsIn(messages: Message[]): { id: string; name: string }[][] {
  const results: { id: string; name: string }[][] = [];
  for (const m of messages) {
    if (m.role !== 'tool') continue;
    try {
      const out = JSON.parse(textOf(m.content));
      if (Array.isArray(out?.rows)) results.unshift(out.rows);
    } catch { /* a denial or an error is plain text */ }
  }
  return results;
}

/** `days` before the YYYY-MM-DD `day`, as YYYY-MM-DD. */
const daysBefore = (day: string, days: number) => new Date(Date.parse(day) - days * 86_400_000).toISOString().slice(0, 10);

/** The scripted reply for a request, chosen by the last message. Without a scripted case it answers about the page. */
function script(body: { messages?: Message[] }): Reply {
  const messages = body.messages ?? [];
  const system = textOf(messages.find((m) => m.role === 'system')?.content);
  const last = messages.at(-1);

  if (last?.role === 'tool') {
    let out: unknown;
    try { out = JSON.parse(textOf(last.content)); } catch { return { text: 'Nothing changed.' }; }
    const rows = (out as { rows?: { name?: string }[] } | null)?.rows;
    if (Array.isArray(rows)) return { text: rows.length ? `${rows.length} found: ${rows.map((r) => r.name).join(', ')}.` : 'None found.' };
    // A view tool's result: quote the view's own finding, as a model told to quote rather than recompute would.
    const view = out as { address?: string; context?: string } | null;
    if (typeof view?.context === 'string') {
      const lines = view.context.split('\n');
      const finding = lines.find((l) => l.startsWith('- Recorded around')) ?? lines[lines.findIndex((l) => l.startsWith('Insights')) + 1] ?? lines[0];
      return { text: `From ${view.address}: ${finding.replace(/^- /, '')}` };
    }
    return { text: 'Done.' };
  }

  if (last?.role === 'user') {
    const said = textOf(last.content).trim();
    // One reply in markdown, for the walk-through that proves the panel RENDERS it rather than printing the model's
    // own `**`, `- ` and `|---|`. Every model this template has been pointed at answers this way, and a fake model
    // that only ever answers one plain sentence cannot tell the two apart.
    if (/markdown/i.test(said)) {
      return { text: [
        '**Traffic** this week, in short:',
        '',
        '- requests are up **12%**',
        '- errors are flat',
        '',
        '| Metric | Value |',
        '| --- | --- |',
        '| Requests | `1204` |',
      ].join('\n') };
    }
    const today = /Today: (\d{4}-\d{2}-\d{2})/.exec(system)?.[1];
    if (today && /support/i.test(said) && /60 days/i.test(said)) {
      const where = [{ field: 'team', op: 'eq', value: 'Support' }, { field: 'role', op: 'eq', value: 'Viewer' }, { field: 'lastActive', op: 'lt', value: daysBefore(today, 60) }];
      return { calls: [{ name: 'query_members', args: { where } }] };
    }
    if (/^suspend them/i.test(said)) {
      const ids = (rowsIn(messages)[0] ?? []).map((r) => r.id);
      if (ids.length) return { calls: [{ name: 'update_members', args: { ids, set: { status: 'Suspended' } } }] };
    }
    const remove = /^remove (.+?)\.?$/i.exec(said)?.[1];
    if (remove) {
      const row = rowsIn(messages).flat().find((r) => r.name.toLowerCase() === remove.toLowerCase());
      if (row) return { calls: [{ name: 'remove_members', args: { ids: [row.id] } }] };
    }
    const period = /^open the overview for the last (\d+) days/i.exec(said)?.[1];
    if (period) return { calls: [{ name: 'view_overview', args: { period: `${period}d` } }] };
    if (/who is suspended/i.test(said)) return { calls: [{ name: 'query_members', args: { where: [{ field: 'status', op: 'eq', value: 'Suspended' }] } }] };
  }

  const title = /Page: (.+?) \(/.exec(system)?.[1];
  return { text: title ? `This is the ${title} page.` : 'Hello.' };
}

function completion(body: { model?: string }, reply: Reply) {
  const base = { id: 'chatcmpl-fake', created: Math.floor(Date.now() / 1000), model: body.model ?? 'fake-model' };
  const usage = { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 };
  return { base, usage, reply };
}

/** Calls in the chat-completions shape, with the arguments as a JSON string. */
const toolCalls = (calls: Call[]) => calls.map((c, i) => ({ id: `call_fake_${Date.now()}_${i}`, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } }));

function send(res: http.ServerResponse, status: number, json: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(json));
}

export async function startFakeLlm({ port }: { port: number }) {
  const requests: any[] = [];

  const server = http.createServer((req, res) => {
    const path = (req.url ?? '').split('?')[0];

    if (req.method === 'GET' && path === '/v1/requests') return send(res, 200, requests);
    if (req.method !== 'POST' || path !== '/v1/chat/completions') return send(res, 404, { error: { message: `no route for ${req.method} ${path}` } });

    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      let body: any;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
      } catch {
        return send(res, 400, { error: { message: 'the request body is not valid JSON' } });
      }
      requests.push(body);

      const last = (body.messages as Message[] | undefined)?.at(-1);
      if (last?.role === 'user' && /fail/i.test(textOf(last.content))) {
        const token = String(req.headers.authorization ?? '').replace(/^Bearer /i, '');
        return send(res, 401, { error: { message: `Incorrect API key provided: ${token}`, type: 'invalid_request_error' } });
      }

      const { base, usage, reply } = completion(body, script(body));
      if (body.stream !== true) {
        return send(res, 200, {
          ...base,
          object: 'chat.completion',
          choices: [{ index: 0, message: 'calls' in reply ? { role: 'assistant', content: null, tool_calls: toolCalls(reply.calls) } : { role: 'assistant', content: reply.text }, finish_reason: 'calls' in reply ? 'tool_calls' : 'stop' }],
          usage,
        });
      }

      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const emit = (delta: object, finish_reason: string | null, extra: object = {}) =>
        res.write(`data: ${JSON.stringify({ ...base, object: 'chat.completion.chunk', choices: [{ index: 0, delta, finish_reason }], ...extra })}\n\n`);
      emit({ role: 'assistant', content: '' }, null);
      if ('calls' in reply) {
        toolCalls(reply.calls).forEach((c, index) => emit({ tool_calls: [{ index, ...c }] }, null));
        emit({}, 'tool_calls', { usage });
      } else {
        emit({ content: reply.text }, null);
        emit({}, 'stop', { usage });
      }
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;

  return {
    url,
    requests,
    close: () => new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); }),
  };
}

if (import.meta.main) {
  const i = process.argv.indexOf('--port');
  const port = i >= 0 ? Number(process.argv[i + 1]) : 0;
  if (!Number.isInteger(port) || port < 0) { console.error('usage: node scripts/fake-llm.ts --port <n>'); process.exit(1); }
  const llm = await startFakeLlm({ port });
  console.log(`fake-llm listening on ${llm.url}`);
}
