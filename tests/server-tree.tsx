/**
 * A server page's tree as a test stands in for Next's render of it.
 *
 * One module because how a server tree is handed over is Next's contract, not a test's: every async component is
 * awaited where it stands, in children and in any prop that holds an element (`PageFrame`'s `meta`). A copy per suite
 * is one place to change when that contract does, and a copy that was forgotten keeps rendering a tree the route would
 * not.
 */
import { act } from '@testing-library/react';
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

/** A server page's tree as Next hands it to the browser: every async component awaited where it stands. */
export async function settled(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(settled));
  if (!isValidElement(node)) return node;
  const { type, props } = node as { type: unknown; props: Record<string, unknown> };
  if (typeof type === 'function' && type.constructor.name === 'AsyncFunction') return settled(await (type as (p: unknown) => Promise<ReactNode>)(props));
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) next[k] = isValidElement(v) || Array.isArray(v) ? await settled(v as ReactNode) : v;
  return cloneElement(node, next);
}

/** The container a server page's answer is drawn into, mounted by `mount` (the suite's own providers). */
export async function markupOf(answer: ReactNode | Promise<ReactNode>, mount: (ui: ReactElement) => { container: HTMLElement }): Promise<HTMLElement> {
  const node = await answer;
  let container = document.body;
  await act(async () => { container = mount(<>{node}</>).container; });
  return container;
}

/** Every `read` prop the tree hands on, in the order it hands them, so a case can hold that one read reaches them all. */
export function readsHandedOn(tree: ReactNode): unknown[] {
  const found: unknown[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!isValidElement(node)) return;
    const props = node.props as Record<string, unknown>;
    if (props.read) found.push(props.read);
    Object.values(props).forEach(walk);
  };
  walk(tree);
  return found;
}
