import type { ColumnPart } from '@/components/charts/column-chart';

/**
 * The three ways an initiative closes, each a usual outcome rather than one that needs somebody, so each takes a
 * categorical slot: one neutral would draw them as one part (ZZ Meridian 0.19.0, docs/data-display.md). One
 * definition, so every chart of outcomes draws an outcome in the same colour and order.
 */
export const OUTCOME_PARTS: ColumnPart[] = [
  { key: 'accepted', label: 'Accepted', color: 1 },
  { key: 'delivered', label: 'Delivered', color: 2 },
  { key: 'abandoned', label: 'Abandoned', color: 3 },
];
