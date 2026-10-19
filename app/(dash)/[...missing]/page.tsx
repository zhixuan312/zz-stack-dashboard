import { gate } from '@/data/access';
import { MISSING_METADATA } from '@/views/missing';
import { MissingPage } from '@/views/no-access';
import { MovedPage, movedFor } from './moved';

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
 *
 * The address is read for one thing only: whether it is one of the console's retired addresses whose page the
 * person's own rail holds (`movedFor`), and then the page says where it went, with the same tab and status. For anyone
 * else, and for every other address, the body is the missing page's, which names nothing.
 */
export default async function MissingAddressPage(props?: { params?: Promise<{ missing?: string[] }> }) {
  const denied = await gate('home');
  if (denied) return denied;
  const moved = await movedFor((await props?.params)?.missing);
  return moved ? <MovedPage moved={moved} /> : <MissingPage />;
}
