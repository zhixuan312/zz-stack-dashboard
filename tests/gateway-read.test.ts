// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The server's read of the gateway asks for the request before it asks for the address. During `next build` there is
 * no request and no gateway address (the image is built without one): reading the cookies is what tells Next to leave
 * the page to request time, and a read that refused for the missing address first failed the build on every gated page.
 */
const read = vi.hoisted(() => ({ cookies: 0 }));
vi.mock('next/headers', () => ({
  cookies: async () => {
    read.cookies++;
    return { get: () => undefined };
  },
  headers: async () => new Headers(),
}));
vi.mock('next/navigation', () => ({ redirect: (to: string) => { throw new Error(`redirect to ${to}`); } }));
vi.mock('@/views/no-access', () => ({ NoAccess: async () => null }));

import { gate } from '@/data/access';
import { GatewayError, gatewayGet } from '@/data/gateway';

/** The bound `src/data/gateway.ts` keeps for `/me`: the page reads' own, `READ_BOUND_MS` in src/lib/api.ts. */
const IDENTITY_BOUND_MS = 4_500;

const saved = { ...process.env };
beforeEach(() => {
  read.cookies = 0;
  Object.assign(process.env, { NODE_ENV: 'production' });
  delete process.env.ZZ_GATEWAY;
  delete process.env.ZZ_DEV_PAT;
});
afterEach(() => {
  process.env = { ...saved };
});

describe('a gateway read with no gateway address', () => {
  it('asks for the request first, then refuses', async () => {
    await expect(gatewayGet('/me')).rejects.toBeInstanceOf(GatewayError);
    expect(read.cookies).toBe(1);
  });

  it('refuses with the same sentence it always has', async () => {
    await expect(gatewayGet('/teams')).rejects.toThrow('This console has no gateway address to read from.');
  });
});

/**
 * The gate's own `/me` read is bounded like a page's reads: a gateway that takes the request and never answers is the
 * gateway-unreachable state, drawn by the bound, never a page that waits for ever. An identity read that cannot be
 * answered is an outage, so `gate` throws and the console's error page draws it (`app/(dash)/error.tsx`).
 */
describe('an identity read the gateway never answers', () => {
  /** A gateway that takes every request and answers none, and stops waiting only when the read gives up. */
  function silent() {
    const asked: string[] = [];
    global.fetch = ((url: string, init?: RequestInit) => {
      asked.push(String(url));
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
      });
    }) as typeof fetch;
    return asked;
  }

  beforeEach(() => {
    process.env.ZZ_GATEWAY = 'http://gateway.test';
    vi.useFakeTimers();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('gives up at the page reads\' bound with the gateway-unreachable state, and not before', async () => {
    const asked = silent();
    let settled: unknown = 'pending';
    const read = gatewayGet('/me').then(() => 'answered', (e: unknown) => e);
    void read.then((v) => { settled = v; });
    await vi.advanceTimersByTimeAsync(IDENTITY_BOUND_MS - 1);
    expect(settled).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    const error = await read;
    expect(error).toBeInstanceOf(GatewayError);
    expect(error).toMatchObject({ status: 504, message: 'The platform did not answer in time, so who is signed in could not be read.' });
    expect(asked).toEqual(['http://gateway.test/api/console/me']);
  });

  it('is an outage to the gate, which throws it to the error page rather than sending anybody to sign in', async () => {
    silent();
    const outcome = gate('home').then(() => 'drawn', (e: unknown) => e);
    await vi.advanceTimersByTimeAsync(IDENTITY_BOUND_MS);
    expect(await outcome).toBeInstanceOf(GatewayError);
  });

  it('bounds who is asking alone: a page read keeps its own bound, set by its page', async () => {
    silent();
    let settled = false;
    void gatewayGet('/home').catch(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(IDENTITY_BOUND_MS * 2);
    expect(settled).toBe(false);
  });
});
