// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { briefExcerpt } from '@/lib/assistant/prompt';

/**
 * The brief names no role and says nothing about what a person cannot do (reconciliation 77, AC-1.7 and AC-1.12). The
 * assistant reads `docs/brief.md` on every reply, for both people, so a word in it reaches a member as surely as one in
 * a page's context: it describes the console's people by what each does, and names Access, where acting for a team is
 * chosen, never the Settings page that is gone. None of the two places a role word stays is in the brief, so it holds
 * none anywhere. The words are `tests/member-chrome.test.tsx`'s, so the two tests hold the same ones, with one shape more
 * that the template's own guidance for Users invites: who "may never be shown" something.
 */
const ROOT = path.resolve(import.meta.dirname, '..');
const BRIEF = fs.readFileSync(path.join(ROOT, 'docs/brief.md'), 'utf8');
/** The brief as one line, so a phrase its wrapping breaks across two lines is still found. */
const FLAT = BRIEF.replace(/\s+/g, ' ');

/** Anywhere. */
const NEVER = /\bsuperadmins?\b|\bread[- ]only\b/gi;
/** Anywhere outside the two places they stay, neither of which is the brief. */
const ROLE_WORDS = /\badmins?\b|\broles?\b/gi;
/** A sentence about what the reader cannot do, or about who else can. */
const CANNOT = /\b(?:you|they) (?:cannot|can't|can ?not|may not|are not (?:allowed|permitted)|do not have (?:access|permission))\b|\b(?:only|ask) (?:a|an|the|your) (?:superadmin|admin|team admin|owner)\b|\bnot (?:allowed|permitted)\b|\bno (?:access|permission)\b|\bmay (?:ever|never) be shown\b/gi;

/** Every match of `re`, each with a little of what surrounds it, so a failure says where. */
const hits = (re: RegExp, text: string): string[] => [...text.matchAll(re)].map((m) => text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40));

/** A `## ` section's body. */
const section = (name: string) => new RegExp(`^## ${name}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(BRIEF)?.[1].trim() ?? '';

describe('the brief', () => {
  it('names no role and no one who can, anywhere', () => {
    expect([...hits(NEVER, FLAT), ...hits(ROLE_WORDS, FLAT)]).toEqual([]);
  });

  it('says nothing about what a person cannot do', () => {
    expect(hits(CANNOT, FLAT)).toEqual([]);
  });

  it('names Access, where acting for a team is chosen, and never Settings', () => {
    expect(BRIEF).not.toMatch(/\bSettings\b/);
    expect(section('Users')).toMatch(/\bAccess\b/);
  });

  it('still tells the assistant who uses each workspace, by what they do, and every word of it arrives', () => {
    const users = section('Users');
    for (const said of ['Work', 'Platform']) expect(users).toMatch(new RegExp(`\\b${said}\\b`));
    const excerpt = briefExcerpt(BRIEF);
    expect(excerpt).toContain(`Users:\n${users}`);
    expect(excerpt).toContain(`Glossary:\n${section('Glossary')}`);
  });
});
