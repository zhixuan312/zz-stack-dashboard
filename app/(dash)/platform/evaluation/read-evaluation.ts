import { gatewayGet } from '@/data/gateway';
import { signInWhenEnded } from '@/data/sign-in';
import type { Evaluation } from '@/lib/platform-shapes';
import { bounded } from '@/lib/read-bound';
import type { EvaluationRead } from '@/logic/platform-evaluation-context';

/**
 * `GET /platform/evaluation` on the console's server, as the person, given `READ_BOUND_MS`: a read that fails says
 * the gateway's own sentence, and one that does not answer by then is said to be slow. It never rejects, so neither of
 * the page's boundaries waits on it longer or falls to the error page, but for a session that ended since the gate let
 * the person in, which goes to sign-in. Nothing is cached: the next request reads again,
 * for its own caller, whose role decides whether the protocols' keys and the findings' own words are in it.
 */
export async function readEvaluation(): Promise<EvaluationRead> {
  try {
    return await bounded(gatewayGet<Evaluation>('/platform/evaluation').then((evaluation): EvaluationRead => ({ state: 'ok', evaluation })), { state: 'slow' });
  } catch (e) {
    await signInWhenEnded(e);
    return { state: 'failed', reason: e instanceof Error ? e.message : 'The gateway did not answer the read.' };
  }
}
