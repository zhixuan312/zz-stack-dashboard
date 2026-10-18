// @vitest-environment node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Every chart is a mapped ZZ Meridian card (Task I-124, AC-2.8): the console's own rule in `scripts/check.local.ts`, run
 * as the gate runs it, over a tree made here and then over the console itself.
 *
 * The tree holds one of each thing the rule refuses: a chart component under `src/components/charts/` that no managed
 * path holds, a page importing it, a page importing a chart package, and the two managed cards no page may draw, the
 * Status list and Uptime bars, which print `Operational` (FR-12, CS-11). Beside them stand a page that imports only
 * mapped cards, one of them through `dynamic()`, and a page whose comment names a refused import, which is a word and
 * not an import.
 */
const CONSOLE = path.resolve(import.meta.dirname, '..');
const RULE = path.join(CONSOLE, 'scripts/check.local.ts');

let tree = '';
function file(rel: string, body: string) {
  fs.mkdirSync(path.dirname(path.join(tree, rel)), { recursive: true });
  fs.writeFileSync(path.join(tree, rel), body);
}
/** The chart rule over `root`: its exit code and the problems it named, one a line. */
function charts(root: string) {
  const run = spawnSync(process.execPath, [RULE, '--charts', root], { encoding: 'utf8' });
  return { status: run.status, lines: run.stdout.trim().split('\n'), stderr: run.stderr };
}

const MANAGED = [
  'src/components/charts/column-chart/index.tsx',
  'src/components/charts/heatmap/index.tsx',
  'src/components/charts/uptime-bars/index.tsx',
  'src/components/patterns/featured-metric/index.tsx',
  'src/components/patterns/status-list/index.tsx',
];

beforeAll(() => {
  tree = fs.mkdtempSync(path.join(os.tmpdir(), 'chart-rule-'));
  file('.meridian/manifest.json', JSON.stringify({ version: '0.17.0', files: Object.fromEntries(MANAGED.map((p) => [p, 'sha256-x'])) }));
  file('.meridian/keep.json', '[]');
  for (const p of MANAGED) file(p, 'export const Card = () => null;\n');
  file('src/components/charts/timeline/index.tsx', 'export function Timeline() { return null; }\n');
  file('src/views/pages/clean.tsx', [
    "import dynamic from 'next/dynamic';",
    "import { Heatmap } from '@/components/charts/heatmap';",
    "import { FeaturedMetric } from '../../components/patterns/featured-metric';",
    "const ColumnChart = dynamic(() => import('@/components/charts/column-chart').then((m) => m.ColumnChart));",
    '',
  ].join('\n'));
  file('src/views/pages/worded.tsx', [
    '/* Not `import { UptimeBars } from \'@/components/charts/uptime-bars\'`: it prints Operational. */',
    "// import { StatusList } from '@/components/patterns/status-list';",
    'export const Worded = () => null;',
    '',
  ].join('\n'));
  file('src/views/pages/own-chart.tsx', "import { Timeline } from '@/components/charts/timeline';\n");
  file('app/(dash)/lazy/page.tsx', "export const Lazy = () => import('../../../src/components/charts/timeline');\n");
  file('src/views/pages/package.tsx', "import { LineChart } from 'recharts';\n");
  file('src/views/pages/doors.tsx', "import { UptimeBars } from '@/components/charts/uptime-bars';\n");
  file('src/console/needs.tsx', "import { StatusList } from '@/components/patterns/status-list';\n");
});
afterAll(() => fs.rmSync(tree, { recursive: true, force: true }));

describe('the chart rule', () => {
  it('fails a chart component that no managed path holds, naming the file and the card', () => {
    const { status, lines } = charts(tree);
    expect(status).toBe(1);
    expect(lines.filter((l) => l.startsWith('src/components/charts/timeline/index.tsx:'))).toEqual([
      expect.stringContaining('the chart timeline is outside .meridian/manifest.json'),
    ]);
  });

  it('fails an import of a chart from anywhere but the managed cards, dynamic or static, named by its file', () => {
    const { lines } = charts(tree);
    expect(lines.find((l) => l.startsWith('src/views/pages/own-chart.tsx:'))).toMatch(/imports the chart timeline from '@\/components\/charts\/timeline', which is not a managed ZZ Meridian card/);
    expect(lines.find((l) => l.startsWith('app/(dash)/lazy/page.tsx:'))).toMatch(/imports the chart timeline from '\.\.\/\.\.\/\.\.\/src\/components\/charts\/timeline'/);
    expect(lines.find((l) => l.startsWith('src/views/pages/package.tsx:'))).toMatch(/imports the chart package recharts/);
  });

  it('fails the Status list and Uptime bars on any page, managed as they are', () => {
    const { lines } = charts(tree);
    expect(lines.find((l) => l.startsWith('src/views/pages/doors.tsx:'))).toMatch(/draws Uptime bars .*Operational/);
    expect(lines.find((l) => l.startsWith('src/console/needs.tsx:'))).toMatch(/draws the Status list .*Operational/);
  });

  it('passes mapped cards, and reads imports rather than the words in a comment', () => {
    const { lines } = charts(tree);
    expect(lines.some((l) => l.startsWith('src/views/pages/clean.tsx:'))).toBe(false);
    expect(lines.some((l) => l.startsWith('src/views/pages/worded.tsx:'))).toBe(false);
    expect(lines.some((l) => l.startsWith('src/components/charts/heatmap/') || l.startsWith('src/components/patterns/'))).toBe(false);
    expect(lines.at(-1)).toBe('6 chart problems');
  });

  it('passes the console as it is, with no chart of its own', () => {
    const { status, lines, stderr } = charts(CONSOLE);
    expect(stderr).toBe('');
    expect(lines).toEqual(['0 chart problems']);
    expect(status).toBe(0);
  });
});
