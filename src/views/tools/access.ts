/**
 * Access's view tool, at `/access`. It takes no arguments, as spec version 8's tool table gives it none: it reads
 * `GET /access`, the same answer its page reads on the server, and its context is the page's, from the same
 * `accessContext`. Its data is `accessAnswer`'s: the labels, dates, states and applications, never a token's value, a
 * hash or a session's id. Its prepared query (`src/views/access-explore.ts`) counts the caller's own tokens. It changes
 * nothing: the assistant never issues, revokes or switches.
 */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { Access } from '@/lib/destination-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { accessAnswer, accessContext } from '../access-context';
import { accessExplore } from '../access-explore';
import { justRead, modeOf } from './shared';

export const accessTool = defineViewTool({
  name: 'access',
  title: 'Access',
  description: 'What lets the person in, and nothing of anybody else\'s: their own tokens by label, state, application and date; the applications they authorised; the browsers they are signed in on, the one asking marked; their passkeys; and the teams they may act for with the one acted for. Never a token\'s value.',
  needs: FEATURES.access.needs,
  page: '/access',
  input: z.object({}),
  async read() {
    await requireNeed(FEATURES.access.needs);
    const [access, mode] = await Promise.all([gatewayGet<Access>('/access'), modeOf()]);
    // A superadmin is the one caller `modeOf` answers the platform for.
    return { context: accessContext(access, { superadmin: mode === 'platform', mode, ...justRead() }), data: accessAnswer(access) };
  },
  explore: accessExplore,
});
