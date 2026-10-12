// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { UIMessage } from 'ai';
import { POST } from '../app/api/assistant/route';
import { ME } from '../scripts/fake-gateway/people.ts';

/**
 * `POST /api/assistant` answers before a model is reached in every case that is not a signed-in person sending a
 * thread to a configured assistant: 401 without a session, 404 without a model, 400 and 413 for what is not a thread.
 * The order matters. A request with no session learns nothing about whether this console has an assistant.
 */
const saved = { ...process.env };
const CONFIGURED = { ASSISTANT_PROVIDER: 'openai-compatible', ASSISTANT_API_KEY: 'k', ASSISTANT_MODEL: 'm', ASSISTANT_BASE_URL: 'http://127.0.0.1:9/v1' };
const signIn = (signedIn: boolean) => {
  global.fetch = (async () => (signedIn
    ? { ok: true, status: 200, json: async () => ME }
    : { ok: false, status: 401, json: async () => ({ error: 'not signed in' }) })) as unknown as typeof fetch;
};
beforeEach(() => {
  for (const k of Object.keys(process.env)) if (k.startsWith('ASSISTANT_')) delete process.env[k];
  process.env.ZZ_GATEWAY = 'http://gateway.test';
});
afterEach(() => { process.env = { ...saved }; });

const post = (body: unknown) => POST(new Request('http://localhost/api/assistant', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }));
const page = { path: '/teams', title: 'Teams', text: '' };
const ask = (id: string): UIMessage => ({ id, role: 'user', parts: [{ type: 'text', text: 'hello' }] });

describe('POST /api/assistant', () => {
  test('answers 401 without a session, configured or not', async () => {
    signIn(false);
    expect((await post({ messages: [ask('u1')], page })).status).toBe(401);
    Object.assign(process.env, CONFIGURED);
    expect((await post({ messages: [ask('u1')], page })).status).toBe(401);
  });

  test('answers 404 to a signed-in person when no model is configured', async () => {
    signIn(true);
    expect((await post({ messages: [ask('u1')], page })).status).toBe(404);
  });

  test('refuses what is not a thread before the model is reached', async () => {
    signIn(true);
    Object.assign(process.env, CONFIGURED);
    for (const messages of [[null], [{}], [{ id: 'u1', role: 'user', parts: 5 }], []]) expect((await post({ messages, page })).status).toBe(400);
    expect((await post('{not json')).status).toBe(400);
    expect((await post({ messages: Array.from({ length: 101 }, (_, i) => ask(`u${i}`)), page })).status).toBe(400);
    expect((await post({ messages: [ask('u1')], page: { ...page, text: 'x'.repeat(2_000_001) } })).status).toBe(413);
  });
});
