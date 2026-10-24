
import { formatCount } from '@/lib/format-units';
import type { WritingCoverage } from '@/lib/work-shapes';

/**
 * The name Record and Home both give the lessons the team's own work made, superseded ones included and an import's
 * left out; Knowledge's Lessons adopted are the lessons standing on the shelf, imports included, a different count under
 * a different name (Phase 7's review, Work F-7 and F-8). A module of its own so Home reads the name without loading
 * Record's words with it.
 */
export const LESSONS_MADE = 'Lessons made';

/**
 * What a chart's column with no data reads, on Home and Record: one short word, whole in the narrowest column that
 * shows a value at rest. "No words recorded" and "Nothing closed" were cut to "No words rec…" and "Nothing close…" in
 * their columns (Phase 7's re-review, Work N-8); the chart's title says what is counted, and the figure above it keeps
 * the longer words.
 */
export const NO_DATA = 'None';

/** What a writing estimate's words leave out, each gap in a few words, as Home and Record both say them: `2 made by an
 *  import left out`. */
export const gapsOf = (c: WritingCoverage): string[] => [
  c.importMade ? `${formatCount(c.importMade)} made by an import left out` : '',
  c.unrecorded ? `${formatCount(c.unrecorded)} with no recorded write` : '',
  c.missingLegacy ? `${formatCount(c.missingLegacy)} missing an earlier revision` : '',
].filter(Boolean);
