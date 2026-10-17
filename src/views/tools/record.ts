/**
 * Record's view tool, at `/record`. Its one argument is spec version 8's: `period`, the route's own, so it reads
 * `GET /record` for the period as the page reads it on the server, the record's first page of ten included, and tells
 * it through the page's `recordContext`. Its prepared query counts the team's closures, words, lessons and runs and the
 * caller's approvals, every one of them answered by Work's `/work/query`.
 */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import { defineViewTool } from '@/lib/shared-context';
import type { RecordRead } from '@/lib/work-shapes';
import { RECORD_DEFAULTS, RECORD_PERIODS, recordContext, recordPath } from '../record-context';
import { RECORD_EXPLORE } from '../record-explore';

export const recordTool = defineViewTool({
  name: 'record',
  title: 'Record',
  description: 'The active team\'s record: what its retained text would take one person to write at the stated pace, as of the cutoff, and the period\'s work closed, documents, knowledge, agents\' runs, firsts and bests, with the record of every initiative; the approvals the caller\'s own.',
  needs: FEATURES.record.needs,
  page: '/record',
  input: z.object({
    period: z.enum(RECORD_PERIODS).optional().describe('The period: this quarter, this year, or all of the record; all when not given.'),
  }),
  async read({ period = 'all' }) {
    await requireNeed(FEATURES.record.needs);
    const filters = { ...RECORD_DEFAULTS, period };
    const data = await gatewayGet<RecordRead>(recordPath(filters));
    return { context: recordContext(data, { filters }), data };
  },
  explore: RECORD_EXPLORE,
});
