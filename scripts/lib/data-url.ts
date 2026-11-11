/**
 * Where a data URL points, for the one decision that has to be right before anything starts: whether the presses and the
 * walk-throughs may run against it. `scripts/browser.ts` refuses a backend that is not this machine, because by the time
 * a press lands the damage is done.
 */

import { isIP } from 'node:net';

/** Only a local file/socket marker, localhost, or a genuine loopback IP proves a local destination. */
export function isLocalHost(host: string): boolean {
  const bracketed = host.startsWith('[') && host.endsWith(']');
  const h = (bracketed ? host.slice(1, -1) : host).toLowerCase();
  if (h === '' || h === 'localhost') return !bracketed;
  const family = isIP(h);
  if (bracketed && family !== 6) return false;
  if (family === 4) return h.startsWith('127.');
  if (family !== 6) return false;
  try {
    // Canonicalize valid IPv6, but refuse unsupported scoped literals rather than throwing out of the safety gate.
    const canonical = new URL(`http://[${h}]`).hostname.slice(1, -1);
    return canonical === '::1' || /^::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}$/.test(canonical);
  } catch {
    return false;
  }
}

/** Every libpq failover destination must be local; a socket does not hide a later network host. */
function hostFromList(value: string, sockets: boolean): string | null {
  let local = '';
  for (const host of value.split(',')) {
    if (!host) return null;
    if (sockets && host.startsWith('/')) continue;
    if (!isLocalHost(host)) return host;
    local = host;
  }
  return local;
}

/**
 * A scheme whose value names a file rather than a machine: Prisma's `file:./dev.db`, `sqlite:///tmp/app.db`. A scheme
 * and nothing more — a host in the authority is read like any other, because `file://db.prod.example.com/share/app.db`
 * is a file on another machine and `libsql://…` is a database over the network.
 */
const FILE_SCHEME = /^(?:file|sqlite|sqlite3|duckdb|libsql):/i;

/**
 * A destination that must be local for this URL to be safe. An empty string identifies a local file/socket; null is
 * unproven. PostgreSQL drivers differ: both effective host and hostaddr must be local, because a driver can ignore
 * hostaddr. Missing network hosts may inherit PGHOST, PGHOSTADDR or a service.
 *
 * Schemeless authorities are read conservatively because a credential may itself contain `/`, `#` or `@`.
 */
export function dataHost(value: string, defaults?: Readonly<Record<string, string | undefined>>): string | null {
  const byHand = (): string | null => {
    // Where the credentials of a DSN written without a scheme end cannot be told from the string alone: a password may
    // hold a `/`, a `#` or an `@` (`user:pa/ss@db.prod.example.com:5432/app`), and so may the query
    // (`db.prod.example.com:5432/app?application_name=svc@web`). So every reading is taken — the value as it starts, when
    // nothing before its path is cut off by an `@`, and what follows each `@` — each cut at its path and its port, and
    // one that is not this machine decides: a wrong guess here refuses a backend rather than writing to it.
    const cut = (v: string) => v.split(/[/?#]/)[0].replace(/:\d+$/, '');
    const authority = value.split('?')[0];
    const parts = authority.split('@');
    const readings = [...(cut(authority).includes('@') ? [] : [cut(authority)]), ...parts.slice(1).map((_, i) => cut(parts.slice(i + 1).join('@')))];
    const hosts = readings.filter((h) => /^[A-Za-z0-9._:[\]-]+$/.test(h) && (!h.includes(':') || isIP(h.replace(/^\[|\]$/g, '')) === 6));
    return hosts.find((h) => !isLocalHost(h)) ?? hosts[0] ?? null;
  };
  const namesAFile = FILE_SCHEME.test(value);
  try {
    const url = new URL(value);
    // URI fields override connection defaults. Check both host and hostaddr: node-postgres ignores hostaddr.
    // A service may supply an address we cannot inspect, so environment fallback alone cannot prove it local.
    if (url.href.startsWith('postgres://') || url.href.startsWith('postgresql://')) {
      let address = defaults?.PGHOSTADDR;
      let host = url.hostname ? decodeURIComponent(url.hostname) : defaults?.PGHOST;
      let service = defaults?.PGSERVICE;
      let explicitAddress = false;
      for (const [key, part] of url.searchParams) {
        if (key === 'hostaddr') { address = part; explicitAddress = true; }
        else if (key === 'host') host = part;
        else if (key === 'service') service = part || defaults?.PGSERVICE;
      }
      if (service && !explicitAddress) return null;
      const destination = host === undefined ? undefined : host ? hostFromList(host, true) : null;
      if (destination === null) return null;
      if (destination !== undefined && !isLocalHost(destination)) return destination;
      if (address !== undefined) return address ? hostFromList(address, false) : null;
      return destination ?? null;
    }
    if (url.hostname) return url.hostname;
    if (namesAFile) return '';
    return /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(value) ? null : byHand();
  } catch {
    return namesAFile ? '' : byHand();
  }
}

/**
 * The data URLs among `values` that are not on this machine, as `NAME → host`, for the refusal `scripts/browser.ts`
 * prints. A value whose host cannot be read is one of them: skipping it is how this gate failed open, since a DSN
 * written without a scheme, or a libpq line (`host=db.prod.example.com user=…`), has no host it can read — and a press
 * against a backend reaches it whatever the string looked like. An empty value names no backend at all.
 */
export function unsafeDataUrls(values: Record<string, string>, defaults: Readonly<Record<string, string | undefined>> = process.env): string[] {
  return Object.entries(values).flatMap(([name, value]) => {
    if (!value) return [];
    const host = dataHost(value, defaults);
    if (host === null) return [`${name} → a value whose host cannot be read`];
    return isLocalHost(host) ? [] : [`${name} → ${host}`];
  });
}
