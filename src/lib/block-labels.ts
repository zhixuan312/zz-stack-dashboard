/**
 * A block's name for a person — FROM THE REGISTRY, with the id as the fallback.
 *
 * This was a hand-written map of four blocks. A fifth got its bare id for a title and
 * "reached over MCP" for a kind, and nothing on the platform said the map existed to be
 * updated — the same fault as drawing every flow as ops-flow, one level down. `zz.block` now
 * carries `title` and `kind` (migration 034) and the API sends them.
 *
 * An undescribed block reads as its id, which is honest and is what this already fell back
 * to. Nothing here needs editing when a block is added.
 */
export function blockTitle(block: { block: string; title?: string | null }): string {
  return block.title ? `${block.block} — ${block.title}` : block.block;
}

export function blockKind(block: { kind?: string | null }): string {
  return block.kind || 'reached over MCP';
}
