import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { consoleMutate } from '@/lib/mutate';

/**
 * Every console write goes through `consoleMutate`. A route that records something and has nothing to say answers 204
 * with no body, which is a success; a refusal still carries the gateway's own sentence.
 */
function gateway(response: Response) {
  vi.stubGlobal('fetch', vi.fn(async () => response));
}
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('consoleMutate', () => {
  it('resolves a 204 with no body', async () => {
    gateway(new Response(null, { status: 204 }));
    await expect(consoleMutate('/page-view', { feature: 'teams' })).resolves.toBeUndefined();
  });

  it('resolves a 200 with the body it answered', async () => {
    gateway(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await expect(consoleMutate('/teams', { slug: 'atlas' })).resolves.toEqual({ ok: true });
  });

  it("rejects a refusal with the gateway's own sentence and its status", async () => {
    gateway(new Response(JSON.stringify({ error: 'That feature is not one the console offers.' }), { status: 400 }));
    const refusal = consoleMutate('/page-view', { feature: 'nowhere' });
    await expect(refusal).rejects.toBeInstanceOf(ApiError);
    await expect(refusal).rejects.toMatchObject({ status: 400, message: 'That feature is not one the console offers.' });
  });
});
