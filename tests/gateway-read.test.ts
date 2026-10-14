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
}));

import { GatewayError, gatewayGet } from '@/data/gateway';

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
