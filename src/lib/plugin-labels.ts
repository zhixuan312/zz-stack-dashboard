/**
 * A plugin's name for a person — FROM THE REGISTRY, with the id as the fallback.
 *
 * This was a hand-written map of four plugins. A fifth got its bare id for a title and
 * "reached over MCP" for a kind, and nothing on the platform said the map existed to be
 * updated — the same fault as drawing every flow as ops-flow, one level down. `zz.plugin` now
 * carries `title` and `kind` (migration 034) and the API sends them.
 *
 * An undescribed plugin reads as its id, which is honest and is what this already fell back
 * to. Nothing here needs editing when a plugin is added.
 */
export function pluginTitle(plugin: { plugin: string; title?: string | null }): string {
  return plugin.title ? `${plugin.plugin} — ${plugin.title}` : plugin.plugin;
}

export function pluginKind(plugin: { kind?: string | null }): string {
  return plugin.kind || 'reached over MCP';
}
