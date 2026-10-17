// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import config from '../scripts/verify.config.ts';

/**
 * An address whose last segment carries a file extension is never a console page, so `proxy.ts` answers it with a bare
 * 404 before anything renders: no shell, no `/me` read, nothing that tells a person which pages exist. Without it a
 * missing `/favicon.ico` reached the catch-all (`app/(dash)/[...missing]/page.tsx`) and came back a 200 page.
 *
 * Two routes do take a file's name at the end of their address, a document and a knowledge node (`spec.md`,
 * `nodes/0002-….md`), and the gateway's own paths are not pages at all: those pass through.
 */
const ROOT = path.resolve(import.meta.dirname, '..');
const APP = path.join(ROOT, 'app');
const saved = { ...process.env };

/** The proxy as a production build runs it: no laptop rewrite to the gateway. */
async function load() {
  vi.resetModules();
  Object.assign(process.env, { NODE_ENV: 'production' });
  delete process.env.ZZ_GATEWAY;
  delete process.env.ZZ_DEV_PAT;
  return (await import('../proxy.ts')).proxy;
}

afterEach(() => {
  process.env = { ...saved };
});

/** What the proxy did with an address: answered it itself, or let it on to the app. */
async function outcome(address: string): Promise<{ status: number; body: string; passed: boolean }> {
  const res = (await load())(new NextRequest(`http://console.test${address}`));
  return { status: res.status, body: await res.text(), passed: res.headers.get('x-middleware-next') === '1' };
}

describe('an address ending in a file name', () => {
  it.each(['/favicon.ico', '/a/b.webp', '/teams.json', '/platform/teams/atlas.csv', '/a/backup.7z'])('%s is a bare 404', async (address) => {
    expect(await outcome(address)).toEqual({ status: 404, body: '', passed: false });
  });

  it.each([
    '/initiatives/atlas/2026-09-28-search-relevance/spec.md',
    '/initiatives/atlas/2026-09-28-search-relevance/sources/notes.md',
    '/knowledge/atlas/nodes/0004-rank-by-recency-first.md',
    '/api/console/document/atlas/2026-09-28-search-relevance/spec.md',
    '/auth/passkey.json',
    // A release's version ends in digits after a dot, which no file extension is.
    '/platform/releases/0.97.0',
    '/platform/releases/0.98.0-rc.1',
  ])('%s passes through', async (address) => {
    expect((await outcome(address)).passed).toBe(true);
  });

  it('lets every address verify walks through, the documents and knowledge nodes among them', async () => {
    const addresses = [...config.detailRoutes.map((r) => r.split('?')[0]), ...config.navigationChecks!.map((c) => c.path)];
    expect(addresses.some((a) => /\.md$/.test(a))).toBe(true);
    for (const address of addresses) expect((await outcome(address)).passed, address).toBe(true);
  });

  it('lets an address with a dot before its last segment through', async () => {
    expect((await outcome('/initiatives/atlas/v1.2/plan')).passed).toBe(true);
  });
});

describe('the route table', () => {
  /** Every page's route, as Next names it: route groups dropped. */
  function pages(dir = APP, segments: string[] = []): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && !/^[_@]/.test(entry.name) && entry.name !== 'api') {
        out.push(...pages(path.join(dir, entry.name), /^\(.*\)$/.test(entry.name) ? segments : [...segments, entry.name]));
      }
      if (entry.name === 'page.tsx') out.push(`/${segments.join('/')}`);
    }
    return out;
  }
  const all = pages();

  it('has no page whose own name carries a dot, so only a parameter can end in a file name', () => {
    for (const route of all) for (const segment of route.split('/').filter((s) => !s.startsWith('['))) expect(segment, route).not.toMatch(/\./);
  });

  it('takes a file name at the end only in the two routes the proxy lets through, and the catch-all', async () => {
    const rest = all.filter((r) => /\[\.\.\.[^\]]+\]$/.test(r));
    expect(rest.sort()).toEqual(['/[...missing]', '/initiatives/[team]/[slug]/[...path]', '/knowledge/[team]/[...path]']);
    for (const route of rest.filter((r) => r !== '/[...missing]')) {
      const address = route.replace(/\[\.\.\.[^\]]+\]/, 'folder/name.md').replace(/\[[^\]]+\]/g, 'x');
      expect((await outcome(address)).passed, address).toBe(true);
    }
  });
});
