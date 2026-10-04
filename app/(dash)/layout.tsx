import type { ReactNode } from 'react';
import { ConsoleFrame } from '@/console/frame';

/** Every console page: the rail on the frame, the page on the canvas, the sign-in gate in front of the page. */
export default function DashLayout({ children }: { children: ReactNode }) {
  return <ConsoleFrame>{children}</ConsoleFrame>;
}
