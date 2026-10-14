// @vitest-environment node
import { spawn, type ChildProcess } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import config from '../scripts/verify.config.ts';

/**
 * Teams, a team and People as the fake gateway answers a member: the gateway's refusal, before anything is read.
 *
 * The refusal is written out here, never read from the fixture: 403 and `{ "error": "not permitted" }`. It is the same
 * whatever the member asks, so it cannot say whether a team exists, and it names no role, person or team. What would
 * have been named is taken from the superadmin's own answers, so the sweep can fail.
 */
type Json = Record<string, any>;

const personas = config.personas!;
const MEMBER = personas.member.cookie.value;
const REFUSAL = { error: 'not permitted' };

let server: ChildProcess;
let base = '';

beforeAll(async () => {
  base = await new Promise<string>((resolve, reject) => {
    server = spawn('node', ['scripts/fake-gateway/server.ts', '--port', '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const timer = setTimeout(() => reject(new Error(`no address printed: ${out}`)), 15_000);
    server.stdout!.on('data', (d: Buffer) => {
      out += String(d);
      const m = /listening on (\S+)/.exec(out);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    server.stderr!.on('data', (d: Buffer) => { out += String(d); });
    server.on('close', (code) => { clearTimeout(timer); reject(new Error(`the fixture exited ${code}: ${out}`)); });
  });
});
afterAll(() => { server?.kill(); });

/** One request as the person a cookie value names; `null` sends no cookie, which is the superadmin. */
const ask = (who: string | null, path: string) => fetch(`${base}/api/console/${path}`, { headers: who === null ? {} : { cookie: `zz_console=${who}` } });
const read = async (who: string | null, path: string): Promise<Json> => {
  const res = await ask(who, path);
  expect(res.status, `${who ?? 'no cookie'} GET ${path}`).toBe(200);
  return res.json();
};

/** Every address a member could ask of the three reads: their own team, another, one nobody has, and the pages and scopes. */
async function asked(): Promise<string[]> {
  const own = (await read(MEMBER, 'me')).activeTeam as string;
  const other = (await read(null, 'teams?limit=100')).teams.map((t: Json) => t.slug).find((s: string) => s !== own) as string;
  const paths = ['teams', 'teams?limit=100', 'teams?q=atlas&status=active', 'teams?limit=0', `teams/${own}`, `teams/${other}`,
                 'teams/no-such-team', 'people', 'people?limit=100', 'people?state=active&offset=5', 'people?limit=500'];
  return paths.flatMap((p) => [p, `${p}${p.includes('?') ? '&' : '?'}scope=platform`]);
}

describe('what a member is answered for Teams and People', () => {
  it('is the gateway\'s refusal, whatever is asked', async () => {
    const paths = await asked();
    expect(paths.length).toBeGreaterThan(20);
    for (const path of paths) {
      const res = await ask(MEMBER, path);
      expect(res.status, `member GET ${path}`).toBe(403);
      expect(await res.json(), `member GET ${path}`).toEqual(REFUSAL);
    }
  });

  it('is the same for a team that exists and one that does not', async () => {
    const own = (await read(MEMBER, 'me')).activeTeam as string;
    const [real, never] = [await ask(MEMBER, `teams/${own}`), await ask(MEMBER, 'teams/no-such-team')];
    expect([real.status, await real.text()]).toEqual([never.status, await never.text()]);
  });

  it('names no role, person or team', async () => {
    const teams = (await read(null, 'teams?limit=100')).teams as Json[];
    const people = (await read(null, 'people?limit=100')).people as Json[];
    const me = await read(MEMBER, 'me');
    const words = [...teams.flatMap((t) => [t.slug, t.name]), ...people.flatMap((p) => [p.email, p.name]), me.email, me.name,
                   'superadmin', 'member', 'admin'];
    const named = new RegExp(`\\b(${words.map((w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');
    // The same words are in what the superadmin is answered, so the sweep can fail.
    expect(named.test(JSON.stringify(teams))).toBe(true);
    for (const path of await asked()) {
      const text = await (await ask(MEMBER, path)).text();
      expect(named.exec(text)?.[0], `member GET ${path}`).toBeUndefined();
    }
  });

  it('still answers the superadmin, so the refusal is the member\'s and not the route\'s', async () => {
    expect((await read(null, 'teams?limit=100')).teams.length).toBeGreaterThan(1);
    expect((await read(null, 'people?limit=100')).people.length).toBeGreaterThan(1);
    expect((await read(personas.superadmin.cookie.value, 'teams/atlas')).team.slug).toBe('atlas');
  });
});
