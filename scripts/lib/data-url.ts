/**
 * Where a data URL points, for the one decision that has to be right before anything starts: whether the presses and the
 * walk-throughs may run against it. `scripts/verify.ts` refuses a backend that is not this machine, because by the time
 * a press lands the damage is done.
 */

/** Can this hostname only be this machine — or a name that can only resolve inside it? */
export function isLocalHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h === '::1' || h === '0.0.0.0') return true;
  if (/^127\./.test(h)) return true;
  // A name with no dot cannot be a public address: a compose service (`postgres`), a container name, a bare hostname.
  return !h.includes('.');
}

/**
 * A scheme whose value names a file rather than a machine: Prisma's `file:./dev.db`, `sqlite:///tmp/app.db`. A scheme
 * and nothing more — a host in the authority is read like any other, because `file://db.prod.example.com/share/app.db`
 * is a file on another machine and `libsql://…` is a database over the network.
 */
const FILE_SCHEME = /^(?:file|sqlite|sqlite3|duckdb|libsql):/i;

/**
 * The host a data URL names; the empty string when it names no host at all, which is this machine (`file:./dev.db`,
 * `postgres:///app` — `isLocalHost('')` is true); or null when the value is not something this can judge, which its
 * caller refuses rather than skips (the app fails on a value it cannot read long before a press lands).
 *
 * Most values are read by `URL`. Four shapes are not, and each matters here because getting it wrong is the difference
 * between refusing a backend and writing to it:
 *
 * - A value written without a scheme parses with its first segment as the *protocol* and no host at all —
 *   `db.prod.example.com:5432/app`. An empty host is a name with no dot, which `isLocalHost` would call local.
 * - A value whose first segment is not a valid protocol at all throws — `10.20.30.40:5432/app`, any bare IP.
 * - A value whose scheme carries an authority with no host (`postgres:///app`) names no host at all, and a value that
 *   names no host is on this machine — unless its query names one, which is where libpq reads a host from and lets it
 *   override the authority: `postgres:///app?host=db.prod.example.com` reaches that host, not this machine.
 * - A file scheme with no host (`file:./dev.db`) is a path on this machine; a file scheme *with* one is not.
 *
 * The first two are read by hand. A value that is not host-shaped (it has a space, say) is null.
 */
export function dataHost(value: string): string | null {
  const byHand = (): string | null => {
    // The authority: everything before its last `@` dropped first — a DSN written without a scheme keeps its
    // credentials (`user:pass@db.prod.example.com:5432/app`), and a password may hold a `/` or a `#`, so cutting at one
    // of those *before* the credentials go reads the password's first word as the host (`user:pa`, a name with no dot,
    // which `isLocalHost` calls local) — then cut at the path, then drop the port.
    const authority = value.replace(/.*@/, '').split(/[/?#]/)[0].replace(/:\d+$/, '');
    return /^[A-Za-z0-9._:[\]-]+$/.test(authority) ? authority : null;
  };
  const namesAFile = FILE_SCHEME.test(value);
  try {
    const url = new URL(value);
    // A host named in the query string decides over the authority, which is how libpq reads it. Read from libpq's own
    // parser (`conninfo_uri_parse_params`): it stores each keyword's value over the last, so the *last* one it is given
    // is the one it dials; it rejects a keyword it does not know outright, so the case of the keyword cannot hide one;
    // and it dials `hostaddr` when both are named, since that is the address and `host` is only how the name is looked
    // up. So the last of each keyword decides, `hostaddr` first — and a value beginning with `/` is a Unix socket,
    // which is dropped, so a value naming both a socket and a host is refused rather than allowed.
    const of = (key: string) => url.searchParams.getAll(key).filter((v) => v && !v.startsWith('/'));
    const named = of('hostaddr').at(-1) ?? of('host').at(-1);
    if (named) return named;
    if (url.hostname) return url.hostname;
    // An empty hostname, then, is one of three things: a scheme that carries an authority and names no host
    // (`postgres:///app`), a file scheme with no host — both this machine — or a value `URL` read as a scheme because
    // it has none, which is a schemeless DSN whose own authority is the host: `db.prod.example.com:5432/app`.
    if (namesAFile) return '';
    return /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(value) ? '' : byHand();
  } catch {
    return namesAFile ? '' : byHand();
  }
}

/**
 * The data URLs among `values` that are not on this machine, as `NAME → host`, for the refusal `scripts/verify.ts`
 * prints. A value whose host cannot be read is one of them: skipping it is how this gate failed open, since a DSN
 * written without a scheme, or a libpq line (`host=db.prod.example.com user=…`), has no host it can read — and a press
 * against a backend reaches it whatever the string looked like. An empty value names no backend at all.
 */
export function unsafeDataUrls(values: Record<string, string>): string[] {
  return Object.entries(values).flatMap(([name, value]) => {
    if (!value) return [];
    const host = dataHost(value);
    if (host === null) return [`${name} → a value whose host cannot be read`];
    return isLocalHost(host) ? [] : [`${name} → ${host}`];
  });
}
