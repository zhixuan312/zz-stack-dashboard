import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A session that ends between the page gate and the page's own read goes to sign-in, back to the address and query the
 * request asked for, on every page: Work's and Platform's read through the one rule (`src/data/sign-in.ts`).
 */
const asked = vi.hoisted(() => ({ path: null as string | null }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(asked.path === null ? {} : { 'x-zz-path': asked.path }),
}));
vi.mock('next/navigation', () => ({ redirect: (to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); } }));
const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));

import { GatewayError } from '@/data/gateway';
import { signIn, signInWhenEnded } from '@/data/sign-in';
import { readStatus } from '../app/(dash)/platform/read-status';
import { readBugs } from '../app/(dash)/platform/bugs/read-bugs';
import { BUGS_DEFAULTS } from '@/logic/platform-bugs-context';

beforeEach(() => {
  asked.path = null;
  gateway.get.mockReset();
});

describe('sign-in after a session ends', () => {
  it('returns to the address and query the request asked for, and only to this site', async () => {
    asked.path = '/approvals?tab=history&page=3';
    expect(await signIn()).toBe(`/login?next=${encodeURIComponent('/approvals?tab=history&page=3')}`);
    asked.path = '//elsewhere.example/x';
    expect(await signIn()).toBe('/login');
    asked.path = null;
    expect(await signIn()).toBe('/login');
  });

  it('acts on a 401 alone', async () => {
    asked.path = '/runs';
    await expect(signInWhenEnded(new GatewayError(401, 'signed out'))).rejects.toThrow('NEXT_REDIRECT /login?next=%2Fruns');
    await expect(signInWhenEnded(new GatewayError(403, 'not yours'))).resolves.toBeUndefined();
    await expect(signInWhenEnded(new Error('down'))).resolves.toBeUndefined();
  });

  it('sends Platform pages to sign-in too, keeping their query, and still says any other failure', async () => {
    gateway.get.mockRejectedValue(new GatewayError(401, 'signed out'));
    asked.path = '/platform';
    await expect(readStatus()).rejects.toThrow('NEXT_REDIRECT /login?next=%2Fplatform');
    asked.path = '/platform/bugs?state=open&page=2';
    await expect(readBugs(BUGS_DEFAULTS)).rejects.toThrow(`NEXT_REDIRECT /login?next=${encodeURIComponent('/platform/bugs?state=open&page=2')}`);
    gateway.get.mockRejectedValue(new GatewayError(503, 'The gateway could not reach its database.'));
    await expect(readStatus()).resolves.toEqual({ state: 'failed' });
  });
});
