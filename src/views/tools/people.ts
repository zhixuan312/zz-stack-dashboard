/**
 * People's view tool, at `/platform/people`. Its arguments are spec version 8's: `limit` and `offset`, the route's own,
 * so it reads `GET /people` as the route pages it, everybody, by the day they were added. It answers what the tool
 * table gives it, the names and states of the read: its context is the page's, at the page of ten the offset falls in,
 * and its data the same rows held to a name and a state, so no address, token or enrolment link reaches the model.
 */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { People } from '@/lib/fleet-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { peopleContext } from '../people-context';
import { peopleExplore } from '../people-explore';
import { PAGE_SIZE, PEOPLE_DEFAULTS, pageAt, peoplePath } from '../people-filter';
import { justRead } from './shared';

export const peopleTool = defineViewTool({
  name: 'people',
  title: 'People',
  description: 'Everybody the platform knows, by the day they were added: each person\'s name and state, under the four tiles (people, with a passkey, never signed in, sign-ins last week).',
  needs: FEATURES.people.needs,
  page: '/platform/people',
  input: z.object({
    limit: z.number().int().min(1).max(100).optional().describe('How many people, 1 to 100; 10 when not given, as the page lists them.'),
    offset: z.number().int().min(0).max(1_000_000).optional().describe('How many people to skip, by the day they were added; 0 when not given.'),
  }),
  async read({ limit = PAGE_SIZE, offset = 0 }) {
    await requireNeed(FEATURES.people.needs);
    const read = { limit, offset };
    const answer = await gatewayGet<People>(peoplePath(PEOPLE_DEFAULTS, read));
    const data = { people: answer.people.map((p) => ({ name: p.name, state: p.state })) };
    return { context: peopleContext(answer, { filters: pageAt(offset), read, ...justRead() }), data };
  },
  explore: peopleExplore,
});
