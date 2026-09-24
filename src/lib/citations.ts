import { knowledgeNodeHref } from "@/lib/knowledge-filters";

/**
 * Turning an `/api/console/ask` citation's raw store path into the console route that shows
 * it.
 *
 * The gateway sends a store path, not a URL — `<initiative>/<path>`, e.g.
 * `_knowledge/nodes/0007-x.md` or `2026-09-08-console-as-an-interface/plan.md`. Which URL
 * shape a path becomes is this app's decision. Two shapes exist:
 *   - a knowledge node (`initiative` is the reserved `_knowledge`) has its own page,
 *     `/knowledge/<team>/<path...>` — see `knowledgeNodeHref`.
 *   - anything else is a document under an initiative:
 *     `/initiatives/<team>/<initiative>/<path...>` (`app/(dash)/initiatives/[team]/[slug]/
 *     [...path]/page.tsx`).
 * A `null` path means the gateway cites a document this team's console cannot open; callers
 * render the title as plain text rather than calling this function.
 *
 * COUPLED: the store-path shapes come from `buildCitations` in the gateway's
 * `console-ask.ts`.
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
