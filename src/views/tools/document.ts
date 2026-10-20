/** One document's view tool, at `/initiatives/[team]/[slug]/[...path]`, and its prepared query held to that document. */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { DocumentDetail } from '@/lib/api-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { documentContext } from '../document-context';
import { file, justRead, segment } from './shared';
import { approvals, words } from './sources';
import { encodePath } from '@/lib/store-path';

export const documentTool = defineViewTool({
  name: 'document',
  title: 'Document',
  description: 'One document of an initiative: what it is, where it stands with its gate, its versions and sources, and how its text opens.',
  needs: FEATURES.initiatives.needs,
  page: '/initiatives/[team]/[slug]/[...path]',
  input: z.object({ team: segment('The team\'s slug.'), slug: segment('The initiative\'s slug.'), path: file('The document\'s path inside the initiative, such as spec.md or sources/notes.md.') }),
  async read({ team, slug, path }) {
    await requireNeed(FEATURES.initiatives.needs);
    const data = await gatewayGet<DocumentDetail>(`/document/${team}/${slug}/${encodePath(path)}`);
    return { context: documentContext(data, justRead()), data };
  },
  explore: {
    sources: { words, approvals },
    // A document's words are its own; its approvals are counted over its initiative, which is what the route keys them by.
    fixed: async ({ slug, path }) => ({
      words: [{ field: 'document', op: 'eq', value: `${slug}/${path}` }],
      approvals: [{ field: 'initiative', op: 'eq', value: slug }],
    }),
  },
});
