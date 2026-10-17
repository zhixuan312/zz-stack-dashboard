'use client';

import { createContext, use, useContext, useEffect } from 'react';
import { dropThread } from './thread';

/** No scope: a preview, or a shell rendered without one, keeps one thread under the empty scope. */
const NONE = Promise.resolve('');
const ThreadScope = createContext<Promise<string>>(NONE);

/**
 * Whose thread the assistant keeps: `scope` is the signed-in person and the tenant they act for, as one key the layout
 * resolves (`<tenant>/<subject>`). The panel loads and saves its thread under it, and names it with every request.
 * Once it resolves, a stored thread of another scope is removed on this page already, before any panel opens, so the
 * conversation of whoever used this browser before goes as soon as someone else is in the console.
 */
export function AssistantScope({ scope, children }: { scope: Promise<string>; children: React.ReactNode }) {
  useEffect(() => {
    let live = true;
    void scope.then((key) => { if (live) dropThread(localStorage, key); }, () => {});
    return () => { live = false; };
  }, [scope]);
  return <ThreadScope value={scope}>{children}</ThreadScope>;
}

/** The scope the thread belongs to; suspends until the layout has resolved it. */
export function useThreadScope(): string {
  return use(useContext(ThreadScope));
}
