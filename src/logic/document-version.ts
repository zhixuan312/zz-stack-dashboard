/**
 * The version an address names on a document's page, `?version=<n>`: what an Approvals history row opens (Work M-6). A
 * row names the version that was approved, so the snapshot read is the one approved in it, its last where none was; the
 * page draws that snapshot's text where a later one replaced it, and the current text, as always, where it is current.
 */
import type { DocumentDetail } from '@/lib/api-shapes';
import { encodePath } from '@/lib/store-path';

/** The version an address asked for, a whole number from 1, or none. */
export function versionOf(param: string | string[] | undefined): number | null {
  const n = Number(Array.isArray(param) ? param[0] : param);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/** One version as the page opens it: its approved snapshot, who approved it and when, and whether a later text replaced it. */
export type OpenedVersion = {
  version: number;
  revision: number;
  approvedBy: string | null;
  approvedAt: string | null;
  /** The snapshot is not the document's current one, so the page reads its text on its own. */
  earlier: boolean;
};

/** The version `version` of `d` as the page opens it, or null for one the document does not have. */
export function openedVersion(d: DocumentDetail, version: number | null): OpenedVersion | null {
  const v = version === null ? undefined : d.versions.find((x) => x.version === version);
  if (!v) return null;
  const approved = v.status === 'approved';
  const sealed = approved ? null : v.superseded_approved;
  const revision = sealed ? sealed.revision : v.revision;
  return {
    version: v.version, revision,
    approvedBy: approved ? v.approved_by : sealed?.approved_by ?? null,
    approvedAt: approved ? v.updated_at : sealed?.approved_at ?? null,
    earlier: revision !== d.current_revision,
  };
}

/** A document's page at one version: the address an approval opens. */
export const versionAddress = (d: Pick<DocumentDetail, 'team' | 'initiative' | 'path'>, version: number): string =>
  `/initiatives/${d.team}/${d.initiative}/${encodePath(d.path)}?version=${version}`;
