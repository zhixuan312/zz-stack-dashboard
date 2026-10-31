/**
 * The data of a part a Platform read answered (`Part<T>` in src/lib/platform-shapes.ts), for a test that reads the
 * fake's answer as a page does. A part that did not answer throws with its reason, so a fixture that stopped answering
 * fails where it is read rather than as an undefined further on.
 */
import type { Part } from '@/lib/platform-shapes';

export function data<T>(p: Part<T> | null): T {
  if (!p) throw new Error('not answered');
  if (p.state !== 'ok') throw new Error(p.reason);
  return p.data;
}
