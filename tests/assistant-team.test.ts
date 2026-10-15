import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { createElement, useEffect, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import type { UIMessage } from 'ai';
import { POST } from '../app/api/assistant/route';
import { THREAD_KEY, loadThread, saveThread } from '@/components/patterns/assistant/thread';
import { ConsoleCaller } from '@/lib/api';
import { MEMBER, ME } from '../scripts/fake-gateway/people.ts';
import { startFakeLlm } from '../scripts/fake-llm.ts';

/**
 * The model never reads another team's or another person's conversation (reconciliation 54). The assistant's route
 * stamps every reply, on its first part, with the caller and the team it was answered for, and a request whose thread
 * holds a reply stamped for anyone else reaches the model with the messages after that reply alone. And the person never
 * sees it: a stored thread whose last stamped reply names another caller or team is cleared before the panel renders.
 */
const NOAH = { caller: MEMBER.email, team: 'atlas' };
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
const reply = (id: string, text: string, metadata?: object, state: 'done' | 'streaming' = 'done'): UIMessage =>
  ({ id, role: 'assistant', metadata, parts: [{ type: 'step-start' }, { type: 'text', text, state }] });
const post = (messages: UIMessage[]) => POST(new Request('http://localhost/api/assistant', { method: 'POST', body: JSON.stringify({ messages, page: { path: '/', title: 'Home', text: '' } }) }));
const events = async (res: Response) => (await res.text()).split('\n').filter((l) => l.startsWith('data: ') && l !== 'data: [DONE]').map((l) => JSON.parse(l.slice(6)));
/** What the model was sent, the system prompt left out: each message's role and text. */
const sent = () => (llm.requests.at(-1) as { messages: { role: string; content: unknown }[] }).messages
  .filter((m) => m.role !== 'system')
  .map((m) => `${m.role}:${typeof m.content === 'string' ? m.content : (m.content as { text?: string }[]).map((p) => p.text ?? '').join('')}`);

describe('every reply the route answers', () => {
  test('carries the caller and the team on its first part', async () => {
    const evs = await events(await post([ask('u1', 'what waits?')]));
    expect(evs[0]).toMatchObject({ type: 'start', messageMetadata: NOAH });
  });

  test('is stamped before the model says anything, so a reply cut off by the switch is stamped too', async () => {
    const res = await post([ask('u1', 'what waits?')]);
    const reader = res.body!.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    await reader.cancel();
    expect(JSON.parse(first.split('\n')[0].slice(6))).toMatchObject({ type: 'start', messageMetadata: NOAH });
  });
});

describe('a thread holding a reply answered for someone else', () => {
  const other = { caller: MEMBER.email, team: 'beacon' };
  const otherPerson = { caller: ME.email, team: 'atlas' };

  test.each([
    ['a reply of another team that finished after the switch', reply('a1', 'old team answer', other)],
    ['a reply of another team cut off mid-stream', reply('a1', 'old team ans', other, 'streaming')],
    ['a reply answered for another person on this browser', reply('a1', 'old team answer', otherPerson)],
  ])('reaches the model with the messages after it alone: %s', async (_, old) => {
    await events(await post([ask('u1', 'old question'), old, ask('u2', 'new question')]));
    expect(sent()).toEqual(['user:new question']);
  });

  test('keeps what came after it, a second tab or a thread saved before the switch writing the old part', async () => {
    await events(await post([ask('u1', 'old question'), reply('a1', 'old team answer', other), ask('u2', 'mine'), reply('a2', 'my answer', NOAH), ask('u3', 'and then?')]));
    expect(sent()).toEqual(['user:mine', 'assistant:my answer', 'user:and then?']);
  });

  test('answers a request with nothing after that reply as a first question', async () => {
    const evs = await events(await post([ask('u1', 'what waits?'), reply('a1', 'old team answer', other)]));
    expect(sent()).toEqual(['user:what waits?']);
    expect(evs[0]).toMatchObject({ type: 'start', messageMetadata: NOAH });
  });

  test.each([
    ['of this caller and team', NOAH],
    ['with no stamp, stored before replies carried one', undefined],
  ])('leaves a thread %s whole', async (_, stamp) => {
    await events(await post([ask('u1', 'q'), reply('a1', 'a', stamp), ask('u2', 'q2')]));
    expect(sent()).toEqual(['user:q', 'assistant:a', 'user:q2']);
  });
});

describe('a stored thread of another caller or team', () => {
  const thread = (metadata?: object) => [ask('u1', 'what waits?'), reply('a1', 'two documents', metadata)];
  const value = { caller: MEMBER.email, team: 'atlas', user: { role: 'Member' } };
  /** The server's answer as it arrives in the browser, already settled, so `use` reads it without suspending. */
  const access = Object.assign(Promise.resolve(value), { status: 'fulfilled', value });

  /** The panel reads its thread in a passive effect on mount, as `AssistantColumn` does. */
  function Panel() {
    const [seen, setSeen] = useState<number | null>(null);
    useEffect(() => setSeen(loadThread(window.localStorage).length), []);
    return createElement('span', { 'data-testid': 'seen' }, seen === null ? '' : String(seen));
  }
  const load = async (stored: UIMessage[]) => {
    saveThread(window.localStorage, stored);
    render(createElement(ConsoleCaller, { access }, createElement(Panel)));
    await waitFor(() => expect(screen.getByTestId('seen')).not.toBeEmptyDOMElement());
    return Number(screen.getByTestId('seen').textContent);
  };

  test.each([
    ['a team switch', { caller: MEMBER.email, team: 'beacon' }],
    ['a second person signing in on the same browser', { caller: ME.email, team: 'atlas' }],
  ])('is cleared before the panel first renders, after %s', async (_, metadata) => {
    expect(await load(thread(metadata))).toBe(0);
    expect(window.localStorage.getItem(THREAD_KEY)).toBeNull();
  });

  test('is read by its last stamped reply: a thread whose last reply is this caller\'s and team\'s is kept', async () => {
    expect(await load([...thread({ caller: MEMBER.email, team: 'beacon' }), ask('u2', 'and?'), reply('a2', 'one', { caller: MEMBER.email, team: 'atlas' })])).toBe(4);
  });

  test('keeps a thread with no stamped reply', async () => {
    expect(await load(thread())).toBe(2);
  });
});
