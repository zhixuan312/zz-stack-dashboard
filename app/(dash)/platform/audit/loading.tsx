import { app, workspaces } from '@/app.config';
import { LoadingPage } from '@/components/patterns/page-loading';
import { gatedLoading } from '@/data/refusal';
import { AuditSkeleton } from './audit-skeleton';

/** Audit on its way: the two tabs, then the acts of administration its plain address opens on. */
export default function PlatformAuditLoading() {
  return (
    <LoadingPage {...gatedLoading({ name: 'audit', title: 'Audit', kicker: <>{app.name} · {workspaces.platform.label}</> })}>
      <AuditSkeleton />
    </LoadingPage>
  );
}
