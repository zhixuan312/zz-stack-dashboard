/**
 * The names a person reads an initiative and its sources by, where the store holds only identifiers: an initiative has
 * a slug and no title of its own, and a source filed with a web address as its title is titled by that address.
 */
import type { InitiativeDetail } from '@/lib/api-shapes';

type Doc = InitiativeDetail['documents'][number];

/** `Spec: relevance that explains itself` names `relevance that explains itself`; a title with no kind before it names nothing. */
const KIND = /^[A-Z][A-Za-z]*:\s+(.+)$/;

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The work's own name, as its documents name it: a flow's documents are titled by their kind and the work's name
 * ("Spec: relevance that explains itself", "Plan: relevance that explains itself"), so the name the most of them carry,
 * the earliest in the order given on a tie. Sources are evidence about the work, not the work, so they name nothing;
 * null when no document names one, and the slug stands alone.
 */
export function initiativeName(documents: Pick<Doc, 'path' | 'title'>[]): string | null {
  const named = new Map<string, number>();
  for (const d of documents) {
    if (d.path.startsWith('sources/')) continue;
    const name = d.title?.trim().match(KIND)?.[1].trim();
    if (name) named.set(name, (named.get(name) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [name, count] of named) if (best === null || count > named.get(best)!) best = name;
  return best === null ? null : sentence(best);
}

/**
 * A source as a person reads it: the title it was filed with, and, where that title is a web address, the page's own
 * name from the address's last part with its host as a note (`docs.example.com`). A source with no title is named by
 * its file, as the store holds it.
 */
export function sourceName(title: string | null, path: string): { name: string; host: string | null } {
  const filed = title?.trim();
  if (!filed) return { name: path.replace(/^sources\//, ''), host: null };
  let url: URL;
  try {
    url = new URL(filed);
  } catch {
    return { name: filed, host: null };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { name: filed, host: null };
  const host = url.hostname.replace(/^www\./, '');
  const last = url.pathname.split('/').filter(Boolean).at(-1);
  const page = last ? decodeURIComponent(last).replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[-_+]+/g, ' ').trim() : '';
  return { name: page ? sentence(page) : host, host };
}
