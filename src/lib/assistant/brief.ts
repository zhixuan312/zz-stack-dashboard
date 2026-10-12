import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Server-only: reads `docs/brief.md` from the working directory with `node:fs`, so only `respond.ts` imports it and
 * nothing the browser bundles may. (`server-only` is not a dependency of the template.) The production build traces the
 * file for the assistant route in `next.config.ts`. Returns the file's text, or '' when it is absent or unreadable; never throws.
 */
export function readBrief(): string {
  try {
    return readFileSync(join(process.cwd(), 'docs', 'brief.md'), 'utf8');
  } catch {
    return '';
  }
}
