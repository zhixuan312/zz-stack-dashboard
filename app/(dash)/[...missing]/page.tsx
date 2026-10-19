import { gate } from '@/data/access';
import { MISSING_METADATA } from '@/views/missing';
import { MissingPage } from '@/views/no-access';

/** The tab says what it says on a refused address (`gatedMetadata`): "Not found", kept out of search. */
export const metadata = MISSING_METADATA;

/**
 * Every address under the shell that no page answers, which Next ranks below every static and dynamic route, so it
 * answers only what nothing else does (`tests/no-access.test.tsx` holds that against the route table).
 *
 * It draws the missing page in the shell at 200, exactly what `gate` draws for an address the person may not open, so an
 * address that names nothing and a refused one cannot be told apart: the same body, the same tab, the same shell and
 * the same status. It never throws `notFound()`. It opens with the gate as every page does, for the feature everyone
 * the console lets in holds, so a request with no session is sent to sign in here exactly as it is on a refused page.
 * The address is never read.
 */
export default async function MissingAddressPage() {
  const denied = await gate('home');
  if (denied) return denied;
  return <MissingPage />;
}
