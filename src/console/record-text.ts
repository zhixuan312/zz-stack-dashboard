/**
 * Record as text, for `Copy as text`: one pure function of the one `RecordRead` the page draws, built from the same words
 * the cards are drawn with (`src/views/record-context.ts`), so what is copied is exactly what is shown. It carries the
 * scope, the cutoff, the coverage, what the words are counted over and the pace the estimate states, and the figures
 * of the lead, its foot and every slice's tiles; a slice that could not be read says so.
 *
 * It copies no chart's points: a column or a cell is pointed at, not displayed as a figure. The pace is the gateway's,
 * read from the estimate itself; the console holds none of its own. Nothing here is time a person did not spend, a rate
 * of working or a comparison of one, and nothing names the days of a week.
 */
import { app } from '@/app.config';
import { formatDate } from '@/lib/format-date';
import type { RecordRead } from '@/lib/work-shapes';
import {
  FIRST, LEAD, SLICES, asOfLine, footOf, leadOf, periodLine, summaryLine, tileText, tilesOf, type SliceKey,
} from '@/views/record-context';

export function recordText(r: RecordRead): string {
  const lead = leadOf(r);
  const tiles = tilesOf(r);
  const lines = [
    `Record · ${app.name}`,
    `${r.meta.population}. ${periodLine(r)} (${r.meta.timezone}).`,
    `${asOfLine(r)}.`,
    '',
    `${LEAD.kicker}: ${lead.text}${lead.pace ? `, ${lead.pace}` : ''}.`,
    lead.basis ? `Counted over ${lead.basis}: ${LEAD.note}.` : LEAD.unread,
  ];
  if (lead.coverage) lines.push(`Coverage: ${lead.coverage}`);
  lines.push('', periodLine(r), ...footOf(r).map((f) => `- ${f.label}: ${f.value}`));
  for (const k of Object.keys(SLICES) as SliceKey[]) {
    const t = tiles[k];
    lines.push('', SLICES[k].title);
    if (!t) { lines.push(`- ${SLICES[k].unread}`); continue; }
    lines.push(...t.map((x) => `- ${x.label}: ${tileText(x)} (${x.note})`));
    if (k === 'firsts' && r.firsts.state === 'ok') lines.push(...r.firsts.data.firsts.map((f) => `- ${FIRST[f.key]}: ${formatDate(f.at)}`));
  }
  const summary = summaryLine(r);
  lines.push('', 'The record', `- ${summary ?? 'The record of initiatives could not be read.'}`);
  return lines.join('\n');
}
