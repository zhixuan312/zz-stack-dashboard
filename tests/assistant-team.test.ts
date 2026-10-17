import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { Suspense, createElement, useEffect, useState, type ComponentProps } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import type { UIMessage } from 'ai';
import { POST } from '../app/api/assistant/route';
import { AssistantScope } from '@/components/patterns/assistant/scope';
import { THREAD_KEY, loadThread, saveThread } from '@/components/patterns/assistant/thread';
import { MEMBER, ME } from '../scripts/fake-gateway/people.ts';
import { startFakeLlm } from '../scripts/fake-llm.ts';

/**
 * The model never reads another team's or another person's conversation (reconciliation 54), held against ZZ
 * Meridian's scoped thread (reconciliation 61). The thread is kept for one person and the team they act for, the scope
 * the layout hands `AssistantScope` and the panel names with every request (`<team>/<email>`). The route answers a
 * thread of its caller's scope, or one that names none, and refuses one of any other scope with 409 before the model
 * is reached; and the person never sees one: a stored thread of another scope is removed as soon as the scope resolves.
 */
const NOAH = `atlas/${MEMBER.email}`;
const saved = { ...process.env };
let llm: Awaited<ReturnType<typeof startFakeLlm>>;
const real = globalThis.fetch;

beforeAll(async () => { llm = await startFakeLlm({ port: 0 }); });
afterAll(async () => { await llm.close(); });
beforeEach(() => {
  Object.assign(process.env, { ZZ_GATEWAY: 'http://gateway.test', ASSISTANT_PROVIDER: 'openai-compatible', ASSISTANT_API_KEY: 'k', ASSISTANT_MODEL: 'm', ASSISTANT_BASE_URL: llm.url });
  llm.requests.length = 0;
  // The gateway names the member acting for atlas; the model's address is the fake's own.
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => (String(input).startsWith('http://gateway.test')
    ? new Response(JSON.stringify(MEMBER), { status: 200, headers: { 'content-type': 'application/json' } })
    : real(input, init))) as typeof fetch;
});
afterEach(() => { globalThis.fetch = real; process.env = { ...saved }; window.localStorage.clear(); });

const ask = (id: string, text: string): UIMessage => ({ id, role: 'user', parts: [{ type: 'text', text }] });
const reply = (id: string, text: string, state: 'done' | 'streaming' = 'done'): UIMessage =>
  ({ id, role: 'assistant', parts: [{ type: 'step-start' }, { type: 'text', text, state }] });
const post = (messages: UIMessage[], scope?: string) =>
  POST(new Request('http://localhost/api/assistant', { method: 'POST', body: JSON.stringify({ messages, page: { path: '/', title: 'Overview', text: '' }, ...(scope === undefined ? {} : { scope }) }) }));
const events = async (res: Response) => (await res.text()).split('\n').filter((l) => l.startsWith('data: ') && l !== 'data: [DONE]').map((l) => JSON.parse(l.slice(6)));
/** What the model was sent, the system prompt left out: each message's role and text. */
const sent = () => (llm.requests.at(-1) as { messages: { role: string; content: unknown }[] }).messages
  .filter((m) => m.role !== 'system')
  .map((m) => `${m.role}:${typeof m.content === 'string' ? m.content : (m.content as { text?: string }[]).map((p) => p.text ?? '').join('')}`);

describe('a thread the route answers', () => {
  test('is one of its caller and the team they act for, and reaches the model whole', async () => {
    const res = await post([ask('u1', 'mine'), reply('a1', 'my answer'), ask('u2', 'and then?')], NOAH);
    expect(res.status).toBe(200);
    await events(res);
    expect(sent()).toEqual(['user:mine', 'assistant:my answer', 'user:and then?']);
  });

  test('names no scope, as a panel with no layout scope sends it, and is answered as the caller\'s', async () => {
    await events(await post([ask('u1', 'q'), reply('a1', 'a'), ask('u2', 'q2')]));
    expect(sent()).toEqual(['user:q', 'assistant:a', 'user:q2']);
  });
});

describe('a thread of another scope', () => {
  test.each([
    ['another team, after the switch', `beacon/${MEMBER.email}`, reply('a1', 'old team answer')],
    ['another team, a reply cut off mid-stream by the switch', `beacon/${MEMBER.email}`, reply('a1', 'old team ans', 'streaming')],
    ['another person on this browser', `atlas/${ME.email}`, reply('a1', 'old person answer')],
    ['no team, from before the person acted for one', `/${MEMBER.email}`, reply('a1', 'old answer')],
  ])('is refused with 409 and nothing of it reaches the model: %s', async (_, scope, old) => {
    const res = await post([ask('u1', 'old question'), old, ask('u2', 'new question')], scope);
    expect(res.status).toBe(409);
    expect(await res.text()).toMatch(/earlier conversation was cleared\. Ask again\./);
    expect(llm.requests).toEqual([]);
  });
});

describe('a stored thread of another scope', () => {
  const thread = [ask('u1', 'what waits?'), reply('a1', 'two documents')];
  /** The layout's scope, as `AssistantScope` is handed it; its children are the element's own. */
  const scoped = () => ({ scope: Promise.resolve(NOAH) }) as ComponentProps<typeof AssistantScope>;

  /** The panel reads its thread in a passive effect on mount, as `AssistantColumn` does, for the layout's scope. */
  function Panel() {
    const [seen, setSeen] = useState<number | null>(null);
    useEffect(() => setSeen(loadThread(window.localStorage, NOAH).length), []);
    return createElement('span', { 'data-testid': 'seen' }, seen === null ? '' : String(seen));
  }
  const load = async (storedFor: string) => {
    saveThread(window.localStorage, storedFor, thread);
    render(createElement(AssistantScope, scoped(), createElement(Suspense, { fallback: null }, createElement(Panel))));
    await waitFor(() => expect(screen.getByTestId('seen')).not.toBeEmptyDOMElement());
    return Number(screen.getByTestId('seen').textContent);
  };

  test.each([
    ['a team switch', `beacon/${MEMBER.email}`],
    ['a second person signing in on the same browser', `atlas/${ME.email}`],
  ])('is removed, never shown, after %s', async (_, storedFor) => {
    expect(await load(storedFor)).toBe(0);
    await waitFor(() => expect(window.localStorage.getItem(THREAD_KEY)).toBeNull());
  });

  test('of this caller and team is kept', async () => {
    expect(await load(NOAH)).toBe(2);
    expect(window.localStorage.getItem(THREAD_KEY)).not.toBeNull();
  });

  test('stored before threads were kept for a scope is shown to nobody', async () => {
    window.localStorage.setItem(THREAD_KEY, JSON.stringify(thread));
    render(createElement(AssistantScope, scoped(), createElement(Panel)));
    await waitFor(() => expect(screen.getByTestId('seen')).toHaveTextContent('0'));
  });
});
