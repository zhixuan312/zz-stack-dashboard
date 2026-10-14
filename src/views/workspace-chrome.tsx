'use client';

/**
 * The console's rail and palette: the release's managed chrome, given the navigation of the workspace the address is in
 * and the destinations the server answered for the person signed in.
 *
 * `access` is `chromeAccess()` from `src/data/access.ts`, one promise the layout makes on the server and does not await:
 * the destinations this person may open and who they are, read off `/me` as the caller. Nothing here reads `/me` or
 * decides a destination: the chrome draws what the server answered, and an identity nobody could resolve settles on
 * `null`, which the release's chrome draws as the placeholder person and no destination.
 *
 * Three things are this console's, where the release's adapter has its own:
 * - **The superadmin's scope.** `The whole platform` and `Your team` are the workspace menu's choices for a superadmin
 *   (`useConsoleMode` in `src/lib/api.ts`, which decides the scope every browser read sends). In `Your team` the rail
 *   and the palette are narrowed to what a member is shown (`shownIn` in `src/nav.ts`), in the browser and over the
 *   server's answer, so the choice can hide a destination and never add one.
 * - **Sign out** is a POST to the gateway, never a link.
 * - **One workspace** is declared today, so the release's workspace switcher has nothing to offer and is not drawn.
 *
 * The address is the only thing that says which workspace is in view, read behind a boundary of its own: reading it
 * makes a component wait for the request on a route with a parameter, and the shell keeps its prerendered frame.
 */
import { usePathname } from 'next/navigation';
import { Suspense, use } from 'react';
import { workspaces, type WorkspaceId } from '@/app.config';
import type { Scope } from '@/components/patterns/rail';
import { useConsoleMode } from '@/lib/api';
import type { ChromeAccess } from '@/lib/collection';
import { shownIn } from '@/nav';
import { ConsolePalette, ConsoleRail, RailPending } from '@/views/console-chrome';
import { navOf, workspaceOf } from '@/views/workspaces';

/** Sign out is a POST, so a link prefetch can never end a session: build the form and submit it. */
function signOut() {
  const form = document.createElement('form');
  form.method = 'post';
  form.action = '/auth/logout';
  document.body.append(form);
  form.submit();
}

/** The workspace the address is in; `main` for an address no entry owns. */
function useWorkspace(): WorkspaceId {
  return workspaceOf(usePathname()) ?? 'main';
}

/** What the server answered, narrowed by the view in force; `null` stays `null`, so nobody is ever named. */
function useShown(access: Promise<ChromeAccess | null>): ChromeAccess | null {
  const chrome = use(access);
  const { mode } = useConsoleMode();
  return chrome && { ...chrome, only: shownIn(chrome.only, mode) };
}

export function WorkspaceRail({ access }: { access: Promise<ChromeAccess | null> }) {
  return (
    <Suspense fallback={null}>
      <RailInView access={access} />
    </Suspense>
  );
}

function RailInView({ access }: { access: Promise<ChromeAccess | null> }) {
  const current = useWorkspace();
  return (
    <Suspense fallback={<RailPending />}>
      <RailFor access={access} current={current} />
    </Suspense>
  );
}

/** The rail once the person is known: their destinations in this workspace, and for a superadmin the scope to read. */
function RailFor({ access, current }: { access: Promise<ChromeAccess | null>; current: WorkspaceId }) {
  const chrome = useShown(access);
  const { mode, setMode } = useConsoleMode();
  const superadmin = chrome?.user.role === 'Superadmin';
  const scopes: Scope[] = superadmin
    ? [
      { id: 'platform', label: 'The whole platform', active: mode === 'platform', onSelect: () => setMode('platform') },
      { id: 'team', label: 'Your team', active: mode === 'team', onSelect: () => setMode('team') },
    ]
    : [];
  const workspace = superadmin ? (mode === 'platform' ? 'The platform' : 'Your team') : workspaces[current].label;
  return <ConsoleRail access={chrome} nav={navOf(current)} workspace={workspace} scopes={scopes} signOut={chrome ? signOut : null} />;
}

export function WorkspacePalette({ access }: { access: Promise<ChromeAccess | null> }) {
  return (
    <Suspense fallback={null}>
      <PaletteInView access={access} />
    </Suspense>
  );
}

function PaletteInView({ access }: { access: Promise<ChromeAccess | null> }) {
  const current = useWorkspace();
  return (
    <Suspense fallback={null}>
      <PaletteFor access={access} current={current} />
    </Suspense>
  );
}

function PaletteFor({ access, current }: { access: Promise<ChromeAccess | null>; current: WorkspaceId }) {
  return <ConsolePalette access={useShown(access)} nav={navOf(current)} />;
}
