/**
 * The ownership guide says it is rendered from the package's own source, never edited by hand. This is that rule: the
 * block between the guide's markers must be `cli/src/ownership.ts`'s `OWNERSHIP` list, rendered as bullets. A rule
 * changed in one place and not the other would tell a team a file is theirs that an update now manages.
 *
 * The list is read, not imported, and `renderOwnership()` is not called: `cli/` is excluded from the payload, so a
 * project that receives this script has no `cli/src/ownership.ts` to import — an import would break the very boundary
 * this file ships across. The regex reads the exported array literal, which is that module's only shape for it.
 */
import fs from 'node:fs';
import path from 'node:path';

export const OWNERSHIP_GUIDE = 'skills/zz-meridian/references/ownership.md';
const BEGIN = '<!-- BEGIN:ownership -->', END = '<!-- END:ownership -->';

/** The guide's problems: a missing block, or a block that differs from the rule. Empty when it is current. */
export function ownershipGuideProblems(root: string): string[] {
  const guide = path.join(root, OWNERSHIP_GUIDE);
  if (!fs.existsSync(guide)) return [];
  const text = fs.readFileSync(guide, 'utf8');
  const from = text.indexOf(BEGIN), to = text.indexOf(END);
  if (from < 0 || to < from) return [`${OWNERSHIP_GUIDE}: no "<!-- BEGIN:ownership -->" … "<!-- END:ownership -->" block for the rule's rendering`];
  // The rule's source is the package's, and a project a payload reached has no `cli/` at all. Nothing to compare there:
  // the guide it ships is the one the release wrote, and the release's own gate holds the two together.
  // Read from the module that owns the rule, through the same renderer the package would use — not by re-parsing its
  // source with a regex, which would be a second reading of one list.
  const source = path.join(root, 'cli/src/ownership.ts');
  if (!fs.existsSync(source)) return [];
  const exported = fs.readFileSync(source, 'utf8').match(/export const OWNERSHIP: readonly string\[\] = \[([\s\S]*?)\n\];/)?.[1] ?? '';
  const rules = [...exported.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'"));
  const lines = rules.map((r) => `- ${r}`).join('\n');
  return text.slice(from, to) === `${BEGIN}\n${lines}\n` ? [] : [`${OWNERSHIP_GUIDE}: the ownership list differs from cli/src/ownership.ts; rewrite the block between the markers from that list`];
}
