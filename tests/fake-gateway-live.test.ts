/**
 * The fake gateway's live stream, as `references/live.md` specifies it.
 *
 * What is asserted here is the contract the console consumes and the refusals a caller can drive, not the framing
 * details: the names a tab may follow, one body for an unknown name and a forbidden one, nothing but `retry` on
 * connect, a hint that names a collection and nothing else, and frames only to the tabs that follow it; and the
 * revisions, as zz-stack's checks/console-live-since.ts holds the real gateway to them: every read answered with its
 * collection's, and a stream asked with them greeted `synced`, or `resync` naming only what moved.
 */
import type { ServerResponse } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { COLLECTIONS, MAX_NAMES, hint, liveStreams, parseNames, revisionHeader, serveLive } from '../scripts/fake-gateway/live.ts';
import { startFakeGateway } from './fake-gateway-start';

/** The least a stream writes to: enough to record the frames and to fire the close handler `serveLive` listens for. */
function stubRes() {
  const frames: string[] = [];
  let onClose: (() => void) | undefined;
  const res = {
    frames,
    writeHead: () => res,
    flushHeaders: () => {},
    write: (frame: string) => { frames.push(frame); return true; },
    end: () => {},
    on: (event: string, handler: () => void) => { if (event === 'close') onClose = handler; return res; },
    away: () => onClose?.(),
  };
  return res as unknown as ServerResponse & { frames: string[]; away: () => void };
}

const events = (frames: string[]) => frames.join('').split('\n').filter((l) => l.startsWith('event: '));

describe('the names a tab may follow', () => {
  it('accepts the console\'s own collections', () => {
    expect(parseNames('teams,initiatives')).toEqual({ names: ['teams', 'initiatives'] });
  });

  it('takes the same name twice as one subscription', () => {
    expect(parseNames('teams,teams')).toEqual({ names: ['teams'] });
  });

  it('refuses an empty or malformed list with 400', () => {
    for (const raw of [null, '', 'teams,', 'teams,,initiatives', 'not a name', 'a'.repeat(65)]) {
      expect(parseNames(raw), String(raw)).toEqual({ status: 400, error: 'Name the collections to follow.' });
    }
  });

  it('refuses more than the bound with 400', () => {
    const many = Array.from({ length: MAX_NAMES + 1 }, (_, i) => `c${i}`).join(',');
    expect(parseNames(many)).toEqual({ status: 400, error: 'Name the collections to follow.' });
  });

  it('answers an unknown name and a forbidden one alike, so neither is disclosed', () => {
    expect(parseNames('bogus')).toEqual({ status: 403, error: 'You do not have access to that.' });
    // A real collection the caller may not read is refused with the same sentence and the same status.
    expect(parseNames('bogus,teams')).toEqual(parseNames('bogus'));
  });

  it('names the console\'s reads, which is what the pages register', () => {
    for (const name of ['me', 'teams', 'initiatives', 'document', 'knowledge', 'plugins', 'skills', 'people', 'runs', 'activity', 'settings']) {
      expect(COLLECTIONS, name).toContain(name);
    }
  });
});

describe('a stream', () => {
  it('opens with `retry` and one greeting resync of the names it follows, and says it does not replay', () => {
    const res = stubRes();
    serveLive(res, ['initiatives', 'knowledge']);
    const text = res.frames.join('');
    expect(text).toContain('retry: 3000');
    // The greeting, as the real gateway sends it (checks/console-live-greeting.ts in zz-stack): ZZ Meridian's stream
    // client takes the first resync as the read the page made while it mounted, and reads again on every later one.
    expect(res.frames.filter((f) => f.startsWith('event: '))).toEqual(['event: resync\ndata: {"collections":["initiatives","knowledge"]}\n\n']);
    expect(text).not.toContain('id:');           // an `id:` would claim a replay the stream cannot make
    res.away();
  });

  it('hints a collection by name and nothing else', () => {
    const res = stubRes();
    serveLive(res, ['initiatives']);
    expect(hint('initiatives')).toBe(1);
    const change = res.frames.find((f) => f.startsWith('event: change'));
    expect(change).toBe('event: change\ndata: {"collection":"initiatives"}\n\n');
    // No record, no team and no cache tag leaves the server: the frame is the collection's name and nothing else.
    expect(change).not.toMatch(/initiative\/|team|tag|\d{4}-\d{2}-\d{2}/);
    res.away();
  });

  it('reaches only the tabs that follow it', () => {
    const follows = stubRes();
    const other = stubRes();
    serveLive(follows, ['initiatives']);
    serveLive(other, ['teams']);
    expect(liveStreams()).toBe(2);
    expect(hint('initiatives')).toBe(1);
    expect(events(follows.frames)).toEqual(['event: resync', 'event: change']);
    expect(events(other.frames)).toEqual(['event: resync']);
    follows.away();
    other.away();
  });

  it('drops a hint for a collection nobody follows', () => {
    const res = stubRes();
    serveLive(res, ['teams']);
    expect(hint('runs')).toBe(0);
    expect(events(res.frames)).toEqual(['event: resync']);
    res.away();
  });

  it('lets go of a tab that went away', () => {
    const res = stubRes();
    serveLive(res, ['teams']);
    expect(liveStreams()).toBe(1);
    res.away();
    expect(liveStreams()).toBe(0);
    expect(hint('teams')).toBe(0);
  });
});

/** The revision a read of `seg` is answered with, as the pair a stream's `since` takes back. */
const revisionOf = (...seg: string[]) => revisionHeader(seg)![1];
const greeting = (names: string[], since: string | null) => {
  const res = stubRes();
  serveLive(res, names, since);
  res.away();
  return res.frames.filter((f) => f.startsWith('event: '));
};
const SYNCED = 'event: synced\ndata: {}\n\n';
const resyncOf = (names: string[]) => `event: resync\ndata: ${JSON.stringify({ collections: names })}\n\n`;

describe('revisions', () => {
  it('answers a read with its collection\'s revision, as the header the real gateway sends', () => {
    expect(revisionHeader(['teams'])).toEqual(['x-zz-revision', expect.stringMatching(/^teams:[A-Za-z0-9_-]+:\d+$/)]);
    expect(revisionOf('teams', 'atlas')).toMatch(/^teams:/);
    // The two reads kept under another's collection, as the console's `src/views/console-live.tsx` keeps them.
    expect(revisionOf('approvals')).toMatch(/^initiatives:/);
    expect(revisionOf('access')).toMatch(/^settings:/);
    // A read no tab may follow carries none.
    for (const seg of [['platform', 'status'], ['search'], ['home'], []]) expect(revisionHeader(seg), seg.join('/')).toBeNull();
  });

  it('greets a stream asked with the revisions just read as synced', () => {
    expect(greeting(['teams', 'runs'], `${revisionOf('teams')},${revisionOf('runs')}`)).toEqual([SYNCED]);
  });

  it('moves a collection\'s revision with each hint, and a stream asked with the old one resyncs that collection alone', () => {
    const [teams, runs] = [revisionOf('teams'), revisionOf('runs')];
    hint('teams');
    expect(revisionOf('teams')).not.toBe(teams);
    expect(revisionOf('runs')).toBe(runs);
    expect(greeting(['teams', 'runs'], `${teams},${runs}`)).toEqual([resyncOf(['teams'])]);
    expect(greeting(['teams', 'runs'], `${revisionOf('teams')},${runs}`)).toEqual([SYNCED]);
  });

  it('resyncs a name whose pair is malformed, or of another boot, and leaves the others as they are', () => {
    const runs = revisionOf('runs');
    expect(greeting(['teams', 'runs'], `teams:not-a-revision,${runs}`)).toEqual([resyncOf(['teams'])]);
    expect(greeting(['teams', 'runs'], `teams,${runs}`)).toEqual([resyncOf(['teams'])]);
    expect(greeting(['teams', 'runs'], `teams:another-boot:0,${runs}`)).toEqual([resyncOf(['teams'])]);
    // A pair for a name the stream does not follow is no part of its greeting.
    expect(greeting(['runs'], `${runs},people:x:1`)).toEqual([SYNCED]);
  });

  it('greets a stream asked with no revisions with a resync of every name, as before', () => {
    expect(greeting(['teams', 'runs'], null)).toEqual([resyncOf(['teams', 'runs'])]);
  });
});

/** The same, over HTTP, as the console's server and the browser meet the fixture: the header on a read, `since` on the stream. */
describe('revisions, as the fixture serves them', () => {
  let fixture: Awaited<ReturnType<typeof startFakeGateway>>;
  beforeAll(async () => { fixture = await startFakeGateway(); });
  afterAll(() => { fixture.proc.kill(); });

  const read = async (path: string) => (await fetch(`${fixture.base}/api/console${path}`)).headers.get('x-zz-revision');
  /** The stream's first event, once it opens. */
  const greetingOf = async (query: string) => {
    const abort = new AbortController();
    const res = await fetch(`${fixture.base}/api/console/live?${query}`, { signal: abort.signal });
    const reader = res.body!.getReader();
    let text = '';
    try {
      while (!text.split('\n\n').some((f) => f.startsWith('event:'))) text += new TextDecoder().decode((await reader.read()).value);
      return text.split('\n\n').find((f) => f.startsWith('event:'));
    } finally {
      abort.abort();
    }
  };

  it('answers a read with its collection\'s revision, and a stream asked with it is synced until a hint moves it', async () => {
    const teams = await read('/teams?limit=10&offset=0');
    expect(teams).toMatch(/^teams:[A-Za-z0-9_-]+:\d+$/);
    expect(await read('/approvals?tab=waiting&limit=100')).toMatch(/^initiatives:/);
    expect(await read('/platform/status')).toBeNull();
    const query = `collections=teams&since=${encodeURIComponent(teams!)}`;
    expect(await greetingOf(query)).toBe('event: synced\ndata: {}');
    await fetch(`${fixture.base}/api/console/__hint?collection=teams`);
    expect(await greetingOf(query)).toBe('event: resync\ndata: {"collections":["teams"]}');
    expect(await greetingOf('collections=teams')).toBe('event: resync\ndata: {"collections":["teams"]}');
  });
});
