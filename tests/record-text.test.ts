import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { createElement, Fragment } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { recordText } from '@/console/record-text';
import { formatDate } from '@/lib/format-date';
import type { RecordRead } from '@/lib/work-shapes';
import { RecordActions, RecordView } from '@/views/pages/record';
import { RECORD_DEFAULTS, asOfLine, footOf, leadOf, periodLine, recordPath, summaryLine, tileText, tilesOf } from '@/views/record-context';
import { ME } from '../scripts/fake-gateway/people.ts';
import { record } from '../scripts/fake-gateway/work-record.ts';

/**
 * `Copy as text` (Task I-105, AC-5.4): one pure function of the record the page draws, so what is copied is exactly
 * what is shown, with the scope, the cutoff, the coverage, what the words are counted over and the gateway's pace, and
 * nothing the record cannot support: no day of the week off, no time a person did not spend, no comparison of rates.
 */
const answer = (q: string) => record(ME, new URLSearchParams(q))[1] as RecordRead;
const ALL = answer('period=all');
const QUARTER = answer('period=quarter');
/** The same record at another pace: the gateway's estimate is the only one there is. */
const SLOWER: RecordRead = { ...ALL, lead: { ...ALL.lead, estimate: { ...ALL.lead.estimate!, assumedWordsPerHour: 250, hours: 1_149.6 } } };
const gone = { state: 'unavailable', reason: 'query_failed' } as const;
/** Words the record cannot support, in any form: a day of the week off, time a person did not spend, a rate of working. */
const UNSUPPORTED = /weekend|saturday|sunday|day off|days off|no day|saved|saving|speed ?up|faster|quicker|gain|productiv|efficien|\d+x\b/i;

const writes: string[] = [];
beforeEach(() => {
  writes.length = 0;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async (t: string) => { writes.push(t); }) } });
  window.history.replaceState(null, '', '/record');
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});
afterEach(() => vi.unstubAllGlobals());

describe('the text', () => {
  it('carries the scope, the period, the cutoff, the coverage, what the words are counted over and the pace', () => {
    const text = recordText(ALL);
    const lead = leadOf(ALL);
    expect(text).toContain(ALL.meta.population);
    expect(text).toContain(`${periodLine(ALL)} (${ALL.meta.timezone})`);
    expect(text).toContain(asOfLine(ALL));
    expect(text).toContain(`One person, writing this: ${lead.text}, estimated at 500 words an hour.`);
    expect(text).toContain(`Counted over 287,400 words your documents and lessons retain as of`);
    expect(text).toContain(`Coverage: ${lead.coverage}`);
  });

  it('carries every figure the page displays: the foot, each slice\'s four tiles, the dated firsts and the record', () => {
    const text = recordText(QUARTER);
    for (const f of footOf(QUARTER)) expect(text).toContain(`- ${f.label}: ${f.value}`);
    for (const tiles of Object.values(tilesOf(QUARTER))) for (const t of tiles!) expect(text).toContain(`- ${t.label}: ${tileText(t)} (${t.note})`);
    for (const f of QUARTER.firsts.state === 'ok' ? QUARTER.firsts.data.firsts : []) expect(text).toContain(formatDate(f.at));
    expect(text).toContain(`- ${summaryLine(QUARTER)}`);
  });

  it('copies another pace when the gateway states another, and nothing of the first', () => {
    const text = recordText(SLOWER);
    expect(text).toContain('One person, writing this: 1,150 h, estimated at 250 words an hour.');
    expect(text).not.toContain('500 words an hour');
  });

  it('never names a day off, time a person did not spend or a rate of working, whatever the record holds', () => {
    for (const r of [ALL, QUARTER, SLOWER, { ...ALL, lead: { ...ALL.lead, estimate: null }, work: gone, agents: gone, firsts: gone, record: gone }]) {
      expect(recordText(r)).not.toMatch(UNSUPPORTED);
    }
  });

  it('says which part could not be read, and draws no figure for it', () => {
    const text = recordText({ ...ALL, lead: { ...ALL.lead, estimate: null }, agents: gone, record: gone });
    expect(text).toContain('One person, writing this: Unavailable.');
    expect(text).toContain('The retained text could not be read, so there is no estimate.');
    expect(text).toContain('- Your agents\' runs could not be read.');
    expect(text).toContain('- The record of initiatives could not be read.');
    expect(text).not.toContain('Observed run coverage');
  });
});

describe('Copy as text', () => {
  const mount = (data: RecordRead) => {
    const served = { state: 'ok' as const, path: recordPath(RECORD_DEFAULTS), data, team: 'atlas' };
    const ui = createElement(Fragment, null, createElement(RecordActions, { served }), createElement(RecordView, { served }));
    return render(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(Tooltip.Provider, null, ui)));
  };

  it('writes the text of the record drawn, and every figure in it is on the page', async () => {
    mount(ALL);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy as text' })); });
    expect(writes).toEqual([recordText(ALL)]);
    const page = document.body.textContent!;
    for (const f of footOf(ALL)) expect(page).toContain(f.value);
    for (const tiles of Object.values(tilesOf(ALL))) for (const t of tiles!) expect(page).toContain(t.note);
    expect(page).toContain(leadOf(ALL).coverage!);
  });

  it('copies the pace the gateway stated for the record drawn', async () => {
    mount(SLOWER);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy as text' })); });
    expect(writes[0]).toContain('estimated at 250 words an hour');
    expect(document.body.textContent).toContain('Estimated at 250 words an hour');
  });
});
