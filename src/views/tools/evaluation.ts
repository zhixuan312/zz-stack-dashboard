/**
 * Evaluation's view tool, at `/platform/evaluation`. It takes no arguments, as spec version 8's tool table gives it none:
 * it reads `GET /platform/evaluation`, the same response its page reads on the server, and its context is the page's,
 * from the same `evaluationContext`. Its prepared query (`src/views/evaluation-explore.ts`) counts the findings and the
 * scores established. It changes nothing: nobody starts an evaluation or decides a finding from the console.
 */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { Evaluation } from '@/lib/platform-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { evaluationExplore } from '../evaluation-explore';
import { evaluationContext } from '../platform-evaluation-context';

export const evaluationTool = defineViewTool({
  name: 'evaluation',
  title: 'Evaluation',
  description: 'Each plugin\'s evaluation as the platform recorded it: the findings waiting for a decision, the scores established, when a plugin was last scored and on how many days; each plugin\'s latest score out of 10 with its range, standing, guardrails, protocol and date; every score by series (one protocol version and one population) with whether the series compare, and the change within a series; the findings by decision and by owner; and the findings waiting, in the form the caller may read.',
  needs: FEATURES.evaluation.needs,
  page: '/platform/evaluation',
  input: z.object({}),
  async read() {
    await requireNeed(FEATURES.evaluation.needs);
    const data = await gatewayGet<Evaluation>('/platform/evaluation');
    return { context: evaluationContext({ state: 'ok', evaluation: data }), data };
  },
  explore: evaluationExplore,
});
