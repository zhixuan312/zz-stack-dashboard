// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { skillText } from '../scripts/fake-gateway/platform.ts';
import { empty } from '../scripts/fake-gateway/states.ts';
import { EMPTY_IS_NORMAL, emptyRule } from '../scripts/states-check.ts';
import config from '../scripts/verify.config.ts';

/**
 * The states check's `empty` rule (scripts/states-check.ts), as a decision on what two reads of one page drew: the page
 * in `empty` and the same page in `normal`. Most pages must say what is empty; a page the fake answers unchanged in
 * `empty` (the skill's shipped text and references) has no empty words to say, and is held to the normal page instead.
 */
const page = (text: string, more: { alert?: boolean; refusal?: boolean } = {}) => ({ text, alert: false, refusal: false, ...more });

const READ = '/plugins/sdlc/sdlc-spec?view=read';
const REFERENCES = '/plugins/sdlc/sdlc-spec?view=references';
const SKILL_TEXT = page('About this skill\nWhose\nOurs\nVersion\n0.73.0\nThe skill\n# sdlc-spec\nRead the approved document this stage starts from.');

describe('the empty rule for a route whose empty answer is the normal one', () => {
  it('lists the skill text and references views, each with its reason, and every one is a detail route verify walks', () => {
    expect(Object.keys(EMPTY_IS_NORMAL).sort()).toEqual([READ, REFERENCES].sort());
    for (const [route, reason] of Object.entries(EMPTY_IS_NORMAL)) {
      expect(config.detailRoutes).toContain(route);
      expect(reason.trim().length).toBeGreaterThan(20);
    }
  });

  it('is listed because the fake answers the skill text read unchanged in empty', () => {
    const body = skillText('sdlc', 'sdlc-spec');
    expect(body).not.toBeNull();
    expect(empty(['plugins', 'sdlc', 'skills', 'sdlc-spec'], body)).toBe(body);
  });

  it('passes a listed route only when its page is the normal page', () => {
    for (const route of [READ, REFERENCES]) {
      const r = emptyRule({ path: route, rail: false }, SKILL_TEXT, SKILL_TEXT);
      expect(r.problems).toEqual([]);
      expect(r.said.join(' ')).toMatch(/normal page/);
    }
  });

  it('passes a listed route whose page differs from the normal page only in its figures', () => {
    const later = page(SKILL_TEXT.text.replace('0.73.0', '0.74.1'));
    expect(emptyRule({ path: READ, rail: false }, later, SKILL_TEXT).problems).toEqual([]);
  });

  it('fails a listed route whose page is not the normal page, even when it says something is empty', () => {
    const lost = page('About this skill\nWhose\nOurs\nThe skill\nNo text recorded for this skill.');
    expect(emptyRule({ path: READ, rail: false }, lost, SKILL_TEXT).problems.join(' ')).toMatch(/not the normal page/);
    const shorter = page('About this skill\nWhose\nOurs');
    expect(emptyRule({ path: REFERENCES, rail: false }, shorter, SKILL_TEXT).problems.join(' ')).toMatch(/not the normal page/);
  });

  it('fails a listed route with no normal page to compare it with', () => {
    expect(emptyRule({ path: READ, rail: false }, SKILL_TEXT, undefined).problems.join(' ')).toMatch(/no normal page/);
  });

  it('fails a listed route whose page draws an alert the normal page does not', () => {
    const alerted = page(SKILL_TEXT.text, { alert: true });
    expect(emptyRule({ path: READ, rail: false }, alerted, SKILL_TEXT).problems.join(' ')).toMatch(/as a failure/);
  });
});

describe('the empty rule for every other route', () => {
  const SKILL_COST = '/plugins/sdlc/sdlc-spec';
  const RUNS = page('Its runs\nRuns\n12\nCalls per run\n4.2');

  it('keeps the empty-words rule: the normal page itself fails', () => {
    expect(emptyRule({ path: SKILL_COST, rail: false }, RUNS, RUNS).problems.join(' ')).toMatch(/no words saying what is empty/);
    expect(emptyRule({ path: '/plugins', rail: true }, RUNS, RUNS).problems.join(' ')).toMatch(/no words saying what is empty/);
  });

  it('passes a page that says what is empty that the normal page does not', () => {
    const none = page('Its runs\nRuns\n0\nNever run by your team');
    const r = emptyRule({ path: SKILL_COST, rail: false }, none, RUNS);
    expect(r.problems).toEqual([]);
    expect(r.said.join(' ')).toMatch(/^empty: "Never run by your team"/);
  });

  it('passes a record a fresh deployment holds none of when it draws the not-found', () => {
    const missing = page('Release 0.97.0 was not found', { refusal: true });
    const r = emptyRule({ path: '/platform/releases/0.97.0', rail: false }, missing, page('Release 0.97.0'));
    expect(r.problems).toEqual([]);
    expect(r.said).toEqual(['not recorded']);
  });

  it('fails a page that says an empty answer failed', () => {
    const failed = page('Its runs\nNo runs recorded\nThe runs’ record did not load');
    expect(emptyRule({ path: SKILL_COST, rail: false }, failed, RUNS).problems.join(' ')).toMatch(/says an empty answer failed/);
  });
});
