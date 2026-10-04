/**
 * A line diff, written here rather than pulled in.
 *
 * The whole need is "show me what changed between this version and the last", over two markdown
 * documents — one classic LCS and about forty lines, against a dependency, a bundle and a
 * supply-chain surface.
 *
 * Lines, not words. These are prose documents where a change is a rewritten paragraph or a new
 * bullet, and a word-level diff of rewritten prose marks every third word and reads as confetti.
 */
type DiffOp = 'same' | 'add' | 'remove';
interface DiffLine { op: DiffOp; text: string; a?: number; b?: number }

/**
 * The most cells the LCS table may hold — `n × m` over the two middles.
 *
 * The table is `(n+1) × (m+1)` numbers, so this is about 32 MB of it. A document here reached
 * 13,279 lines, and two revisions of it compared wholesale would be 176 million cells: not slow,
 * out of memory.
 */
const MAX_LCS_CELLS = 4_000_000;

export function diffLines(before: string, after: string): DiffLine[] {
  const A = before.replace(/\r\n/g, '\n').split('\n');
  const B = after.replace(/\r\n/g, '\n').split('\n');

  /* The common head and tail are taken off before the LCS sees anything.
   *
   * An edit to a long document changes a region in the middle, and everything outside it is
   * identical on both sides. The LCS below is O(n·m) in what it is handed, so trimming first
   * turns a 13,090-line revision compared with a 13,279-line one — 174 million cells — into the
   * few hundred lines that actually differ, which is a diff the table can hold.
   *
   * Both loops are bounded by `head` on the tail pass, so a document compared against itself
   * takes every line as head and never counts one line twice. */
  let head = 0;
  while (head < A.length && head < B.length && A[head] === B[head]) head++;
  let tail = 0;
  while (tail < A.length - head && tail < B.length - head
         && A[A.length - 1 - tail] === B[B.length - 1 - tail]) tail++;

  const out: DiffLine[] = [];
  A.slice(0, head).forEach((text, i) => out.push({ op: 'same', text, a: i + 1, b: i + 1 }));

  const midA = A.slice(head, A.length - tail);
  const midB = B.slice(head, B.length - tail);
  if (midA.length * midB.length > MAX_LCS_CELLS) {
    // Too large to align. The middle is reported as wholly replaced rather than guessed at or
    // allowed to exhaust memory: every line is stated, and `collapse` is what bounds what is
    // rendered. Only a comparison of two revisions that share almost nothing reaches this.
    midA.forEach((text, i) => out.push({ op: 'remove', text, a: head + i + 1 }));
    midB.forEach((text, i) => out.push({ op: 'add', text, b: head + i + 1 }));
  } else {
    lcs(midA, midB, head, head, out);
  }

  A.slice(A.length - tail).forEach((text, i) =>
    out.push({ op: 'same', text, a: A.length - tail + i + 1, b: B.length - tail + i + 1 }));
  return out;
}

/** Longest common subsequence over two middles, appended to `out`.
 *
 * O(n·m) is fine at this size and is the version anybody reviewing this can check against the
 * textbook; the trimming above and `MAX_LCS_CELLS` are what keep `n` and `m` small. `aOff`/`bOff`
 * are how many lines were taken off the head, so a line number still refers to the document. */
function lcs(A: string[], B: string[], aOff: number, bOff: number, out: DiffLine[]): void {
  const n = A.length, m = B.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = A[i] === B[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ op: 'same', text: A[i], a: aOff + i + 1, b: bOff + j + 1 }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { out.push({ op: 'remove', text: A[i], a: aOff + i + 1 }); i++; }
    else { out.push({ op: 'add', text: B[j], b: bOff + j + 1 }); j++; }
  }
  while (i < n) { out.push({ op: 'remove', text: A[i], a: aOff + i + 1 }); i++; }
  while (j < m) { out.push({ op: 'add', text: B[j], b: bOff + j + 1 }); j++; }
}

/** The most lines the panel will render, changes and context together.
 *
 * Not a diff bound — the diff is computed in full and this is what is drawn. A reader comparing
 * two revisions that share almost nothing is looking at tens of thousands of changed lines, and
 * the browser is not going to lay out tens of thousands of table rows to say so. What was left
 * out is stated, never silently dropped. */
const MAX_SHOWN_LINES = 1000;

/**
 * Drop the unchanged middle, keeping `context` lines around each change. Runs of untouched lines
 * collapse to a marker carrying how many were hidden, so nothing is silently dropped.
 *
 * `truncated` is how many lines the cap above left unrendered; 0 is the ordinary case.
 */
export function collapse(lines: DiffLine[], context = 3): {
  lines: (DiffLine | { op: 'skip'; n: number })[]; truncated: number;
} {
  const keep = new Set<number>();
  lines.forEach((l, idx) => {
    if (l.op === 'same') return;
    for (let k = idx - context; k <= idx + context; k++) if (k >= 0 && k < lines.length) keep.add(k);
  });
  const out: (DiffLine | { op: 'skip'; n: number })[] = [];
  let run = 0;
  let truncated = 0;
  lines.forEach((l, idx) => {
    if (keep.has(idx)) {
      if (run) { out.push({ op: 'skip', n: run }); run = 0; }
      if (out.length < MAX_SHOWN_LINES) out.push(l);
      else truncated++;
    } else run++;
  });
  if (run) out.push({ op: 'skip', n: run });
  return { lines: out, truncated };
}

export function diffStat(lines: DiffLine[]): { added: number; removed: number } {
  return {
    added: lines.filter((l) => l.op === 'add').length,
    removed: lines.filter((l) => l.op === 'remove').length,
  };
}
