/**
 * A line diff, written here rather than pulled in.
 *
 * The whole need is "show me what changed between this version and the last", over two markdown
 * documents of a few hundred lines — one classic LCS and about forty lines, against a dependency, a
 * bundle and a supply-chain surface.
 *
 * Lines, not words. These are prose documents where a change is a rewritten paragraph or a new
 * bullet, and a word-level diff of rewritten prose marks every third word and reads as confetti.
 */
type DiffOp = 'same' | 'add' | 'remove';
interface DiffLine { op: DiffOp; text: string; a?: number; b?: number }

export function diffLines(before: string, after: string): DiffLine[] {
  const A = before.replace(/\r\n/g, '\n').split('\n');
  const B = after.replace(/\r\n/g, '\n').split('\n');

  // Longest common subsequence over lines. O(n·m) is fine at this size and is the version anybody
  // reviewing this can check against the textbook.
  const n = A.length, m = B.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = A[i] === B[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ op: 'same', text: A[i], a: i + 1, b: j + 1 }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { out.push({ op: 'remove', text: A[i], a: i + 1 }); i++; }
    else { out.push({ op: 'add', text: B[j], b: j + 1 }); j++; }
  }
  while (i < n) out.push({ op: 'remove', text: A[i], a: ++i });
  while (j < m) out.push({ op: 'add', text: B[j], b: ++j });
  return out;
}

/**
 * Drop the unchanged middle, keeping `context` lines around each change. Runs of untouched lines
 * collapse to a marker carrying how many were hidden, so nothing is silently dropped.
 */
export function collapse(lines: DiffLine[], context = 3): (DiffLine | { op: 'skip'; n: number })[] {
  const keep = new Set<number>();
  lines.forEach((l, idx) => {
    if (l.op === 'same') return;
    for (let k = idx - context; k <= idx + context; k++) if (k >= 0 && k < lines.length) keep.add(k);
  });
  const out: (DiffLine | { op: 'skip'; n: number })[] = [];
  let run = 0;
  lines.forEach((l, idx) => {
    if (keep.has(idx)) {
      if (run) { out.push({ op: 'skip', n: run }); run = 0; }
      out.push(l);
    } else run++;
  });
  if (run) out.push({ op: 'skip', n: run });
  return out;
}

export function diffStat(lines: DiffLine[]): { added: number; removed: number } {
  return {
    added: lines.filter((l) => l.op === 'add').length,
    removed: lines.filter((l) => l.op === 'remove').length,
  };
}
