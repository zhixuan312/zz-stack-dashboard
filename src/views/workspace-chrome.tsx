'use client';

/**
 * The console's rail and palette: the release's managed chrome, given the navigation of the workspace the address is in
 * and the destinations the server answered for the person signed in.
 *
 * `access` is `chromeAccess()` from `src/data/access.ts`, one promise the layout makes on the server and does not await:
 * the destinations this person may open, who they are and the team they act for, read off `/me` as the caller. Nothing
 * here reads `/me` or decides a destination: the chrome draws what the server answered, and an identity nobody could
 * resolve settles on `null`, which the release's chrome draws as the placeholder person and no destination.
 *
 * The workspace menu is the release's: a workspace is offered when the person may open at least one of its
 * destinations, its row opens the workspace's home (or the first destination they may open when the home is not one),
 * and with one workspace left there is nothing to switch between; the line under the product name is the workspace in
 * view, as the release writes it. The menu holds the workspaces and nothing else: there is no console scope
 * (reconciliation 76), so the rail and the palette are what the server answered, for a superadmin as for anybody, and
 * acting for a team is Access's team switch. Sign out is this console's: a POST to the gateway, never a link.
 *
 * The address is the only thing that says which workspace is in view, read behind a boundary of its own: reading it
 * makes a component wait for the request on a route with a parameter, and the shell keeps its prerendered frame.
 */
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, use } from 'react';
import { workspaces, type WorkspaceId } from '@/app.config';
import { useLeave } from '@/components/base/shell';
import type { Scope } from '@/components/patterns/rail';
import type { ConsoleChromeAccess } from '@/data/access';
import { ConsolePalette, ConsoleRail, RailPending, visible } from '@/views/console-chrome';
import { navOf, workspaceOf } from '@/views/workspaces';

/** Every declared workspace, in the order the menu lists them. */
const WORKSPACES = Object.keys(workspaces) as WorkspaceId[];

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

export function WorkspaceRail({ access }: { access: Promise<ConsoleChromeAccess | null> }) {
  return (
    <Suspense fallback={null}>
      <RailInView access={access} />
    </Suspense>
  );
}

function RailInView({ access }: { access: Promise<ConsoleChromeAccess | null> }) {
  const current = useWorkspace();
  return (
    <Suspense fallback={<RailPending />}>
      <RailFor access={access} current={current} />
    </Suspense>
  );
}

/** The rail once the person is known: their destinations in this workspace, and where else they may go. */
function RailFor({ access, current }: { access: Promise<ConsoleChromeAccess | null>; current: WorkspaceId }) {
  // What the server answered; `null` stays `null`, so nobody is ever named.
  const chrome = use(access);
  const router = useRouter();
  const leave = useLeave();
  const open = (id: WorkspaceId) => (chrome ? visible(chrome.only, navOf(id)).flatMap((g) => g.items.map((i) => i.href)) : []);
  const offered = WORKSPACES.filter((id) => open(id).length > 0);
  const places: Scope[] = offered.length > 1
    ? offered.map((id) => ({
      id: `workspace:${id}`,
      label: workspaces[id].label,
      active: id === current,
      // Choosing the workspace already in view does nothing, so the page and its filters stay.
      onSelect: () => {
        if (id === current) return;
        const home = workspaces[id].homeHref;
        leave(() => router.push(open(id).includes(home) ? home : open(id)[0]!));
      },
    }))
    : [];
  return <ConsoleRail access={chrome} nav={navOf(current)} workspace={workspaces[current].label} scopes={places} signOut={chrome ? signOut : null} />;
}

export function WorkspacePalette({ access }: { access: Promise<ConsoleChromeAccess | null> }) {
  return (
    <Suspense fallback={null}>
      <PaletteInView access={access} />
    </Suspense>
  );
}

function PaletteInView({ access }: { access: Promise<ConsoleChromeAccess | null> }) {
  const current = useWorkspace();
  return (
    <Suspense fallback={null}>
      <PaletteFor access={access} current={current} />
    </Suspense>
  );
}

function PaletteFor({ access, current }: { access: Promise<ConsoleChromeAccess | null>; current: WorkspaceId }) {
  return <ConsolePalette access={use(access)} nav={navOf(current)} />;
}
