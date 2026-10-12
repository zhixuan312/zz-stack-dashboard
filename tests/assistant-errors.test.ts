// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { APICallError, RetryError, type UIMessage } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { respond } from '@/lib/assistant/respond';

/** Permits everything: this file is about the stream, the guard has its own tests. */
const guard = { authorize: async () => true, invalidate: () => {} };

const KEY = 'sk-ant-very-secret-value';
const ask: UIMessage[] = [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }];
const failing = (error: unknown) => new MockLanguageModelV4({ doStream: async () => { throw error; } });
/** A provider error that is not retried, so the reply fails at once. */
const apiError = (statusCode: number) => new APICallError({ message: `Provider said: invalid x-api-key ${KEY}`, url: 'https://api.anthropic.com/v1/messages', requestBodyValues: { key: KEY }, statusCode, responseBody: `{"error":"bad key ${KEY}"}`, isRetryable: false });
/** What the SDK raises after retrying a retryable error until it gives up. */
const gaveUp = (statusCode: number) => new RetryError({ message: `Failed after 3 attempts: ${KEY}`, reason: 'maxRetriesExceeded', errors: [apiError(statusCode)] });
async function errorText(error: unknown): Promise<string> {
  const res = await respond({ model: failing(error), secret: 's'.repeat(43), messages: ask, page: { path: '/', title: 'Overview', text: '' }, collections: [], guard, now: new Date('2026-10-03T09:00:00Z') });
  const body = await res.text();
  expect(body).not.toContain(KEY);
  const events = body.split('\n').filter((l) => l.startsWith('data: ') && l !== 'data: [DONE]').map((l) => JSON.parse(l.slice(6)));
  return events.find((e) => e.type === 'error')?.errorText ?? '';
}

describe('a provider failure, in plain words', () => {
  test('a refused key says the assistant is not set up, and never repeats the key', async () => {
    for (const status of [401, 403]) expect(await errorText(apiError(status))).toMatch(/not set up/i);
  });

  test('a rate limit asks to try again shortly', async () => {
    expect(await errorText(apiError(429))).toMatch(/try again in a minute/i);
    expect(await errorText(gaveUp(429))).toMatch(/try again in a minute/i);
  });

  test('anything else says the provider could not be reached', async () => {
    expect(await errorText(apiError(500))).toMatch(/could not reach/i);
    expect(await errorText(gaveUp(503))).toMatch(/could not reach/i);
    expect(await errorText(new TypeError(`fetch failed for ${KEY}`))).toMatch(/could not reach/i);
  });
});
