/**
 * What the browser suites read from scripts/verify.config.ts. The file is the team's, so each field is read through the
 * shape a suite needs, here once, and a field the team left out is empty rather than a type error.
 */
import config from '../verify.config.ts';

type Cookie = { name: string; value: string };

/** The detail routes the team names (a dynamic segment `discover()` cannot list), or none. */
export const detailRoutes: string[] = (config as { detailRoutes?: string[] }).detailRoutes ?? [];

/**
 * The cookie that signs a browser in as the persona `as` names, for `--as`; undefined without `--as`. A name the config
 * does not declare ends the run (exit 1) with the declared names, so a typo never measures the page as nobody.
 */
export function personaCookie(script: string, as: string): Cookie | undefined {
  if (!as) return undefined;
  const personas = (config as { personas?: Record<string, { cookie: Cookie }> }).personas ?? {};
  const found = personas[as];
  if (!found) {
    console.error(`${script}: --as ${as} is not a declared persona. Declared personas: ${Object.keys(personas).join(', ')}.`);
    process.exit(1);
  }
  return found.cookie;
}
