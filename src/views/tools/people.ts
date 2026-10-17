/** People's view tool, at `/people`, and its prepared query over the people and their sign-ins. */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { Person } from '@/lib/api-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { peopleContext } from '../people-context';
import { EVERY_ROW, justRead, modeOf, search } from './shared';
import { people, signIns } from './sources';

export const peopleTool = defineViewTool({
  name: 'people',
  title: 'People',
  description: 'Everyone on the platform, filtered: their role, their teams, and whether their tokens are live and used.',
  needs: FEATURES.people.needs,
  page: '/people',
  input: z.object({ q: search.describe('Text in the name or the email.'), team: z.string().max(100).optional().describe('A team\'s slug.') }),
  async read({ q = '', team = 'all' }) {
    await requireNeed(FEATURES.people.needs);
    const data = await gatewayGet<{ people: Person[]; total: number }>(`/people?${EVERY_ROW}`);
    return { context: peopleContext(data.people, data.total, { filters: { q, team }, mode: await modeOf(), ...justRead() }), data };
  },
  explore: { sources: { people, signIns } },
});
