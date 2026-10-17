/**
 * What the model is told when a view tool throws (`assistantTools` in `./tools.ts`).
 *
 * The SDK hands the model a thrown tool's message as the tool's result. A view tool throws the console's refusal or
 * the gateway's own sentence (`GatewayError`), and the gateway's sentence can name the path asked, the person, the
 * team or the database it could not reach. So nothing of a thrown error reaches the model: each case is one fixed
 * sentence, chosen by the kind of failure and never filled from it, and the error itself stays the mapped one's cause,
 * for the server's log.
 */
import { AccessDenied, Unauthenticated } from '@/data/access';
import { GatewayError } from '@/data/gateway';

/** The sentence for each way a tool fails. `refused` is the console's own refusal, word for word (`AccessDenied`). */
const TOOL_FAILURES = {
  refused: 'You do not have access to that.',
  rejected: 'The platform did not accept that read: nothing is at that address, or the read does not take those arguments. Check them against the tool\'s description.',
  failed: 'The platform could not answer that read just now. Tell the person it is unavailable, and do not guess what it would have said.',
  timeout: 'The platform did not answer that read in time. Try once more, or tell the person it is slow.',
} as const;

/** A tool that threw, with the one sentence the model is told; what was thrown is its cause. */
export class ToolFailed extends Error {
  constructor(sentence: string, cause: unknown) {
    super(sentence, { cause });
    this.name = 'ToolFailed';
  }

  /** The sentence alone: the SDK tells the model `String(error)`, which would otherwise open with the class's name. */
  override toString(): string {
    return this.message;
  }
}

/** A fetch that gave up waiting: aborted by a signal's timeout, or undici's own connect, headers or body timeout. */
function timedOut(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'TimeoutError' || error.name === 'AbortError') return true;
  const code = (error.cause as { code?: unknown } | undefined)?.code;
  return typeof code === 'string' && /TIMEOUT/.test(code);
}

/**
 * The sentence for `error`: a refusal, the console's or the gateway's 401 and 403; any other 4xx, which is an address
 * or an argument the platform does not take; a 5xx, or anything else that failed; and a read that timed out.
 */
export function toolFailure(error: unknown): Error {
  const sentence = error instanceof AccessDenied || error instanceof Unauthenticated ? TOOL_FAILURES.refused
    : error instanceof GatewayError
      ? (error.status === 401 || error.status === 403 ? TOOL_FAILURES.refused : error.status >= 400 && error.status < 500 ? TOOL_FAILURES.rejected : TOOL_FAILURES.failed)
      : timedOut(error) ? TOOL_FAILURES.timeout : TOOL_FAILURES.failed;
  return new ToolFailed(sentence, error);
}
