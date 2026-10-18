'use client';

import { useShareView } from '@/components/base/use-share-view';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, useSearchDraft, type Column } from '@/components/patterns/data-table';
import { FilterBar } from '@/components/patterns/filter-bar';
import { Records } from '@/components/templates/records';
import { Badge } from '@/components/ui/badge';
import { CopyField } from '@/components/ui/copy-field';
import { aligned } from '@/console/columns';
import { ScoreCell, scoreFact } from '@/console/eval-score';
import { failureOf } from '@/console/query';
import { useDataClock } from '@/lib/api';
import type { PluginRow } from '@/lib/api-shapes';
import { plural } from '@/lib/format';
import { formatCount } from '@/lib/format-units';
import { useLive } from '@/lib/live';
import { pendingContext } from '@/views/context';
import {
  PLUGINS_DEFAULTS, PLUGINS_PATH, inView, pluginsContext, readTrouble, type Catalog, type PluginsFilters, type PluginsRead,
} from '@/views/plugins-context';
import { useAddress, useServed } from '@/views/use-served';

/** The card the list's Ask sits on, and the name `Protagonist:` gives it in the page's README. */
const PLUGINS_TITLE = 'Every plugin';

/** The command that installs a plugin, to take elsewhere: a person copies it into their own client. */
const Install = ({ p }: { p: PluginRow }) => <CopyField value={p.install} label={`the command that installs ${p.plugin}`} className="w-full max-w-56" />;

/**
 * The spec's columns, in its order: plugin, required or optional, version, skills, gates, the score out of 10 with its
 * protocol and date, and the install command with its Copy control. Nothing here is the team's: the catalog and the
 * scores are the platform's, and the team's use is on each plugin's page, labelled as the team's.
 *
 * The plugin and its blurb are cut to the width there is, whole in the cell's title, and under 896px the version and the
 * counts give way, each on the plugin's own page the row opens: the table was 1629px in a 1109px frame at 1440, its Copy
 * buttons off screen and out of the keyboard's reach. The score and Install, which a person acts on, stay at every width.
 */
const COLUMNS: Column<PluginRow>[] = aligned([
  {
    key: 'plugin', header: 'Plugin', grow: true, truncate: true, mobile: 'title', title: (p) => (p.description ? `${p.plugin}: ${p.description}` : p.plugin),
    cell: (p) => (
      <span className="block min-w-0">
        <span className="block truncate font-medium text-ink" title={p.plugin}>{p.plugin}</span>
        {p.description ? <span className="t-caption block truncate" title={p.description}>{p.description}</span> : null}
      </span>
    ),
    mobileCell: (p) => <span className="[overflow-wrap:anywhere]">{p.plugin}</span>,
  },
  { key: 'required', header: 'Required', mobile: 'status', cell: (p) => (p.required ? <Badge tone="accent">Required</Badge> : <Badge tone="neutral">Optional</Badge>) },
  {
    // The version and whether a release vouched for it together: the number is a claim and the release makes it true.
    key: 'version', header: 'Version', hideBelow: 'lg',
    cell: (p) => (p.version
      ? <span className="inline-flex flex-col items-center"><span className="font-mono text-xs text-ink">{p.version}</span><span className="text-2xs text-ink-3">{p.release ? 'released' : 'not released'}</span></span>
      : <span className="text-ink-3">None declared</span>),
  },
  { key: 'skills', header: 'Skills', numeric: true, hideBelow: 'lg', cell: (p) => formatCount(p.skills.length) },
  { key: 'gates', header: 'Gates', numeric: true, hideBelow: 'lg', cell: (p) => formatCount(p.gates) },
  { key: 'score', header: 'Score', mobile: 'fact', cell: (p) => <ScoreCell of={p.score} />, mobileCell: (p) => scoreFact(p.score) },
  { key: 'install', header: 'Install', width: 'w-56', mobile: 'fact', cell: (p) => <Install p={p} />, mobileCell: (p) => <Install p={p} /> },
]);

/**
 * The page's read: the catalog the console's server read for it, so the first paint carries the rows and the browser
 * asks for nothing more, then the browser's own once the plugins collection changes or a Retry asks. The search narrows
 * the rows here: the catalog is one read whatever the address holds. A failure is stated only when there is nothing
 * to draw.
 */
function usePlugins(served: PluginsRead) {
  const { q, follow } = useServed<Catalog>(PLUGINS_PATH, true);
  const data = q.data ?? (served.state === 'ok' ? served.data : undefined);
  const failed = failureOf(q);
  const trouble = data ? null : failed ?? (served.state !== 'ok' && !q.isFetching ? readTrouble(served) : null);
  const retry = () => (q.data !== undefined || q.error ? void q.refetch() : follow());
  return { data, trouble, retry, updatedAt: q.data ? new Date(q.dataUpdatedAt) : served.state === 'ok' ? served.at : null };
}

/**
 * Every plugin in the catalog, drawn from the release's Records template: no tiles, the table the spec names, its
 * search and its Ask in the filter bar. The catalog is read on the console's server and handed here with the search
 * the address held, which the first paint narrows by; the plugins collection's live updates and a Retry are the
 * browser's. No control on it starts an evaluation.
 */
export function PluginsView({ served, addressed = null }: { served: PluginsRead; addressed?: PluginsFilters | null }) {
  useLive(['plugins']);
  const [filters, set] = useAddress(PLUGINS_DEFAULTS, addressed);
  const [draft, setDraft] = useSearchDraft(filters.plugin, (plugin) => set({ plugin }));
  const { data, trouble, retry, updatedAt } = usePlugins(served);
  const now = useDataClock();
  useShareView(data
    ? pluginsContext(data.plugins, { filters, updatedAt, now })
    : pendingContext({ view: 'plugins', title: 'Plugins', address: PLUGINS_PATH, scope: 'every plugin in the catalog, and your active team\'s use of each' }, trouble));
  const rows = data ? inView(data.plugins, filters) : [];
  const narrow = filters.plugin.trim() !== '';
  const clear = () => set({ plugin: '' });

  return (
    <Records>
      <div data-protagonist={PLUGINS_TITLE} className="contents">
        <DataTable
          caption="Plugins"
          noun="plugins"
          rows={rows}
          columns={COLUMNS}
          rowKey={(p) => p.plugin}
          rowHref={(p) => `/plugins/${p.plugin}`}
          loading={!data && !trouble}
          error={trouble ?? undefined}
          onRetry={retry}
          filtered={narrow}
          onClearFilters={clear}
          empty={{ title: 'No plugin in the catalog', body: 'A plugin appears here once the platform ships one.' }}
          toolbar={
            <FilterBar
              search={{ value: draft, onChange: setDraft, placeholder: 'Search plugins' }}
              result={data ? `${formatCount(rows.length)} ${plural(rows.length, 'plugin')}` : trouble ? '—' : '…'}
              ask={<AskAbout question={narrow ? 'What are the plugins in this list for, and which of them should we install?' : 'What is each plugin for, how far can its score be trusted, and which should we install?'} />}
              onClear={clear}
            />
          }
        />
      </div>
    </Records>
  );
}
