/* A TABLE CELL'S CONTENT IS INLINE-LEVEL, or the column header stops sitting over it.
 *
 * `Table` sets the alignment for every column in one rule — middle columns centre, the first
 * is left, the last is right — and `text-align` only moves INLINE content. A block-level box
 * inside a cell takes the full cell width and hands placement to its own `justify-content`,
 * which defaults to `flex-start`. The cell is still centred; what is drawn inside it is not.
 *
 * WHAT IT LOOKS LIKE, and why it is worth a build failure rather than a review note: the
 * column header centres, the content sits hard left, and the two read as different columns.
 * It was reported three separate times on three separate pages — "the header and content not
 * in a row", "header is again not in same col" — and each was fixed on its own, because from
 * a screenshot it looks like a width problem rather than one rule applied five times. The
 * cases were `FlowMini` on /initiatives and a team page, and the badge rows on /plugins, both
 * /knowledge pages and the people panel.
 *
 * THE FIX IS ALWAYS THE SAME WORD: `inline-flex` instead of `flex`. An inline-level flex
 * container shrinks to its content and obeys whatever alignment the cell sets, which is the
 * behaviour every other cell already has.
 *
 * This reads the two lines after a `<TableCell`, which is where a wrapper lands in this
 * codebase. A cell whose content is a COMPONENT is not checked here — the component owns its
 * own display, and `FlowMini` carries the reasoning at its own definition.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** `flex` or `grid` as a whole word at the start of a class list — `inline-flex` and
 *  `flex-wrap` must not match, which is why the boundary is spelled rather than assumed. */
const BLOCK_LEVEL = /className="(?:[^"]*\s)?(flex|grid)(?=\s|")/;

const walk = (d: string, out: string[] = []): string[] => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
};

const bad: string[] = [];
for (const file of [...walk('app'), ...walk('src')]) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (!line.includes('<TableCell')) return;
    // The wrapper is either on the same line as the cell or on the next one.
    for (const [n, candidate] of [[i, line], [i + 1, lines[i + 1] ?? '']] as [number, string][]) {
      if (n === i && !/<TableCell[^>]*>\s*<\w/.test(candidate)) continue;
      const m = BLOCK_LEVEL.exec(candidate);
      if (m && !candidate.includes('<TableCell') === (n !== i)) {
        bad.push(`${file}:${n + 1} a block-level \`${m[1]}\` inside a table cell — the cell's `
          + `alignment cannot move it, so the column header will not sit over it. Use `
          + `\`inline-${m[1]}\`.`);
      }
    }
  });
}

if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log('PASS every table cell wrapper is inline-level');
