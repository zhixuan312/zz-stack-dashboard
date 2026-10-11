/**
 * A tool installed in this project, run from node_modules/.bin, so the gates work under pnpm, npm, yarn or bun alike.
 */
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');

// The gate, verify and the live check run `next` in the project: Meridian's own runs send no Next.js telemetry, whatever
// the project's next.config says.
process.env.NEXT_TELEMETRY_DISABLED ??= '1';

export const bin = (name: string) => path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name);
