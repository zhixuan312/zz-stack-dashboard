import { gate } from '@/data/access';
import { InitiativesView } from '@/views/pages/initiatives';

/** The page asks `initiatives` before it renders; the rail hiding a destination is presentation, never this gate. */
export default async function InitiativesPage() {
  const denied = await gate('initiatives');
  if (denied) return denied;
  return <InitiativesView />;
}
