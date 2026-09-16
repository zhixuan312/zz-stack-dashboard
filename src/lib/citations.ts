import { knowledgeNodeHref } from "@/lib/knowledge-filters";

/**
 * Turning an `/api/console/ask` citation's raw store path into the console route that
 * actually shows it.
 *
 * THE GATEWAY SENDS A STORE PATH, NOT A URL — `<initiative>/<path>`, e.g.
 * `_knowledge/nodes/0007-x.md` or `2026-09-08-console-as-an-interface/plan.md` (see
 * `console-ask.ts`'s own `buildCitations`, which says explicitly why: which URL shape a
 * path becomes is this app's decision, not the gateway's). Two shapes exist today:
 *   - a knowledge node (`initiative` is the reserved `_knowledge`) has its own page,
 *     `/knowledge/<team>/<path...>` — see `knowledgeNodeHref`.
 *   - anything else is a document under an initiative, which DOES have its own route:
 *     `/initiatives/<team>/<initiative>/<path...>` (`app/(dash)/initiatives/[team]/[slug]/
 *     [...path]/page.tsx`).
 * A `null` path (the gateway's own way of saying "this cites a real document, but not one
 * this team's console can open" — see `buildCitations`'s header) has no href at all;
 * callers render the title as plain text rather than calling this function.
 */
export function citationHref(path: string, team: string): string {
  if (path === "_knowledge" || path.startsWith("_knowledge/")) {
    return knowledgeNodeHref(team, path.slice("_knowledge/".length));
  }
  const slash = path.indexOf("/");
  const initiative = slash === -1 ? path : path.slice(0, slash);
  const rest = slash === -1 ? "" : path.slice(slash + 1);
  const encodedRest = rest.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `/initiatives/${encodeURIComponent(team)}/${encodeURIComponent(initiative)}${encodedRest ? `/${encodedRest}` : ""}`;
}
