/**
 * What a route's answer says about what a suite measured. A not-found or an error page has a heading, a main and
 * controls like any other, so a suite that never asked measured it as the route it asked for and passed: a mistyped
 * detail route, or an address a suite was pointed at by hand, read "0 issues" over the not-found screen.
 *
 * A route is not found when it answered 404 or draws the not-found screen, `[data-missing-page]` (MissingPage in the
 * shell, the root not-found outside it). Both, since a record page that finds no record inside a streamed shell has
 * already answered 200 by the time it knows: under Cache Components the sample's missing records answer 200 and draw
 * the screen. So a route is held to what it is declared to be. The routes meant to be missing are named: `missingRoutes`
 * in scripts/verify.config.ts, the address no page claims (`/this-page-does-not-exist`, which `discover()` adds), and
 * any a run names with `--missing`. Every other route answers below 400 and draws no not-found screen.
 */
import config from '../verify.config.ts';

/** The address `discover()` adds so every suite meets the product's not-found screen. */
export const NOT_FOUND_PROBE = '/this-page-does-not-exist';

/** What a page draws when it is the not-found screen. A product's own not-found screen carries it too. */
export const NOT_FOUND_SCREEN = '[data-missing-page]';

/** In the page: whether it draws the not-found screen. */
export const DRAWS_NOT_FOUND = `!!document.querySelector(${JSON.stringify(NOT_FOUND_SCREEN)})`;

/** The routes meant to be missing, from the team's config and the run's own `--missing a,b`. */
export function missingRoutes(args: readonly string[]): string[] {
  const i = args.indexOf('--missing');
  const named = i >= 0 ? (args[i + 1] ?? '').split(',').filter(Boolean) : [];
  return [...new Set([NOT_FOUND_PROBE, ...((config as { missingRoutes?: string[] }).missingRoutes ?? []), ...named])];
}

/**
 * The problem with a route's answer, or null when it answered as declared. `status` is the document's (0 when none
 * arrived, which the suite's own measurement reports in its own terms); `drawn` is whether the page draws the not-found
 * screen.
 */
export function answerProblem(route: string, status: number, drawn: boolean, missing: readonly string[]): string | null {
  if (!status) return null;
  const meant = missing.includes(route);
  if (meant) return status === 404 || (drawn && status < 400) ? null : `${route} is in missingRoutes, and it answered ${status} and draws no not-found screen (${NOT_FOUND_SCREEN}): it is meant to be a record that does not exist`;
  if (status >= 400) return `${route} answered ${status}, so what was measured is its error page and not the route. A route meant to be missing goes in missingRoutes in scripts/verify.config.ts`;
  if (drawn) return `${route} draws the not-found screen (${NOT_FOUND_SCREEN}), so what was measured is not the route. A route meant to be missing goes in missingRoutes in scripts/verify.config.ts`;
  return null;
}
