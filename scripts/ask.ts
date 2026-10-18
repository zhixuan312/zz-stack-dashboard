/**
 * Ask a served product's assistant the questions its page specifications list.
 *
 *   node scripts/ask.ts --base <url> [--view <name>] [--path <address>] [--as <persona>] [--out <folder>]
 *
 * Each page specification lists, under `### What the agent does here`, the questions a person on that page asks that
 * its context does not answer alone (FR-42). This asks each of them, one thread a question, of `POST /api/assistant` on
 * the page's own address, signed in as a persona of `scripts/verify.config.ts`: the one `--as` names, else the one keyed
 * `owner`, else the first declared. A detail page's questions are asked on its first record: the first link of its
 * form on its listing page, unless `--path` names the record (`--path /customers/c_42`), which asks the page that
 * renders that address. Every view with questions is asked, or the one `--view` names, by its name or as its tool
 * (`usage` or `view_usage`).
 *
 * Each question carries the page as the console's panel sends it, as near as a script can: the page's title and its
 * visible text, read from the page as it is served to that persona, without any node marked `data-assistant="omit"`,
 * as the panel leaves it out. The view's shared context is not sent: a view
 * publishes it in the browser, so a script that fetches the page cannot read it, and the assistant answers from the
 * page's text and its tools.
 *
 * For each view it writes `<folder>/<view>.md` (`out/asks/` unless `--out` names another), one file a page: a view is
 * named by its tool, wherever in the registry the tool is defined, else by its route (`/things/[id]` is `things-id`),
 * and two views that would share a name are told apart by their routes. It holds each question, every tool
 * the assistant called with its input and what the tool returned, every Proposal it raised with its approval or denial,
 * and the answer's text, for a reader to judge whether the answer is the tools' and no change is claimed without a
 * Proposal (AC-14.8). A question the assistant answered with a Proposal alone is answered.
 *
 * It reads no environment. Whether the assistant is on is the served product's to say: `POST /api/assistant` answers
 * 404 while it is off, and the script then prints one line saying it did not run, and exits 0, as it does when the
 * configuration declares no persona. Neither `pnpm verify` nor `pnpm verify --full` runs it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { agentSection, pageSpecs, viewToolPages } from './lib/routes.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

/** The questions a page specification lists under `### What the agent does here`, in order; none without the section. */
export function questionsOf(md: string): string[] {
  return agentSection(md)?.questions.map((q) => q.question) ?? [];
}

type Personas = Record<string, { cookie: { name: string; value: string } }>;

/**
 * Who the questions are asked as: the persona `as` names, else the one keyed `owner`, else the first declared, as the
 * `Cookie` header that signs a request in. A configuration that declares none, or no persona of that name, does not run.
 */
export function personaFor(config: { personas?: Personas }, as?: string): { run: true; persona: string; cookie: string } | { run: false; why: string } {
  const names = Object.keys(config.personas ?? {});
  if (!names.length) return { run: false, why: 'scripts/verify.config.ts declares no personas to ask as' };
  const persona = as ?? (names.includes('owner') ? 'owner' : names[0]);
  const found = config.personas![persona];
  if (!found) return { run: false, why: `no persona named ${persona}; scripts/verify.config.ts declares ${names.join(', ')}` };
  return { run: true, persona, cookie: `${found.cookie.name}=${found.cookie.value}` };
}

/** A view whose specification lists questions, and the page they are asked on. */
type View = { name: string; page: string; title: string; questions: string[] };

/**
 * A page's name without a view tool, from its route: `/things` is `things`, `/things/[id]` is `things-id`, a catch-all's
 * dots and every bracket dropped. The root page takes its own folder's name, `(home)` being `home`.
 */
const routeName = (route: string, folder: string) => (route === '/' ? folder.replace(/[()]/g, '') : route.split('/').filter(Boolean).map((s) => s.replace(/[[\].]/g, '')).join('-'));

/**
 * Every view with questions, each with a name of its own: the name its view tool gives it, wherever in the registry the
 * tool is defined, else its route's (`routeName`). One name is one transcript, so two views never share one: a name two
 * views would share is followed by the route's, and a name still shared then is refused.
 */
export function viewsOf(specs: readonly { route: string; folder: string; title?: string; questions: string[] }[], tools: readonly { name: string; page: string }[]): View[] {
  const named = specs.filter((s) => s.questions.length).map((s) => {
    const name = tools.find((t) => t.page === s.route)?.name ?? routeName(s.route, s.folder);
    return { name, page: s.route, title: s.title ?? name, questions: s.questions };
  });
  const count = (vs: View[], n: string) => vs.filter((v) => v.name === n).length;
  const apart = named.map((v) => (count(named, v.name) > 1 ? { ...v, name: `${v.name}-${routeName(v.page, '') || 'root'}` } : v));
  const shared = [...new Set(apart.filter((v) => count(apart, v.name) > 1).map((v) => v.name))];
  if (shared.length) throw new Error(`two views would write one transcript: ${shared.join(', ')}; give each view tool a name of its own`);
  return apart;
}

/** The views of this project: its page specifications that list questions, named by `viewsOf`. */
function views(): View[] {
  return viewsOf(pageSpecs().map(({ file, route }) => {
    const md = fs.readFileSync(path.join(ROOT, file), 'utf8');
    return { route, folder: path.posix.basename(path.posix.dirname(file)), title: /^# (.+)$/m.exec(md)?.[1], questions: questionsOf(md) };
  }), viewToolPages() ?? []);
}

/**
 * The views asked: every one, the one `--view` names (by its name or as the assistant's tool, `view_<name>`), or the
 * one whose page renders the address `--path` names. Where several pages render it, the most specific one, as Next.js
 * picks: fewer dynamic segments first.
 */
export function chosenOf(all: readonly View[], want?: string, at?: string): { views: View[]; error?: string } {
  const named = want === undefined ? [...all] : all.filter((v) => v.name === want || `view_${v.name}` === want);
  if (want !== undefined && !named.length) return { views: [], error: `no view named ${want} lists questions; these do: ${all.map((v) => v.name).join(', ')}` };
  if (at === undefined) return { views: named };
  const bare = at.split(/[?#]/)[0].replace(/(.)\/+$/, '$1');
  const dynamic = (page: string) => (page.match(/\[/g) ?? []).length;
  const rendering = named.filter((v) => new RegExp(`^${formOf(v.page)}$`).test(bare)).sort((a, b) => dynamic(a.page) - dynamic(b.page));
  if (!rendering.length) return { views: [], error: `no page${want === undefined ? '' : ` of ${want}`} with questions renders ${at}; these do: ${named.map((v) => v.page).join(', ')}` };
  return { views: [rendering[0]] };
}

/** HTML's void elements: they have no closing tag. */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
/** The elements whose text is not markup: a `<` inside them opens no tag. */
const RAW = new Set(['script', 'style', 'textarea', 'title']);

/** Where the element whose start tag begins at `from` ends: just past its closing tag, nested elements of its name counted. */
function elementEnd(html: string, from: number): number {
  const open = /^<([a-zA-Z][\w-]*)[^>]*?(\/?)>/.exec(html.slice(from));
  if (!open) return from;
  const tag = open[1].toLowerCase();
  if (VOID.has(tag) || open[2]) return from + open[0].length;
  const tags = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g;
  tags.lastIndex = from + open[0].length;
  let depth = 1;
  for (let m = tags.exec(html); m; m = tags.exec(html)) {
    const name = m[2]?.toLowerCase();
    if (!name) continue;
    if (!m[1] && RAW.has(name) && name !== tag) {
      // A script or a style is skipped whole, so a tag written inside it counts for nothing.
      const close = html.indexOf(`</${name}`, tags.lastIndex);
      tags.lastIndex = close < 0 ? html.length : close;
      continue;
    }
    if (name !== tag || m[3]) continue;
    depth += m[1] ? -1 : 1;
    if (!depth) return tags.lastIndex;
  }
  return html.length;
}

/** The index of the start tag of the element whose `id` is `id`, or -1. */
const startOf = (html: string, id: string) => html.search(new RegExp(`<[a-zA-Z][\\w-]*[^>]*\\sid="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
/** What the element whose `id` is `id` holds, or null. */
function inner(html: string, id: string): string | null {
  const at = startOf(html, id);
  if (at < 0) return null;
  const end = elementEnd(html, at);
  const body = html.slice(at, end);
  return body.slice(body.indexOf('>') + 1, body.lastIndexOf('</'));
}

/**
 * The page as a browser shows it once its stream has arrived. A served page streams: each part that waits on data is
 * first its loading fallback, marked `<!--$?--><template id="B:n">`, and arrives later as a hidden segment (`<div
 * hidden id="S:n">`) that a script moves into place, `$RC("B:n","S:n")` (`$RR` with stylesheets) for a boundary,
 * `$RS("S:n","P:n")` for a placeholder. The same moves are made here, until none is left that can be.
 */
export function arrived(html: string): string {
  const moves = [...html.matchAll(/\$(RC|RR|RS)\("([^"]+)","([^"]+)"/g)].map(([, fn, a, b]) => (fn === 'RS' ? { segment: a, into: b, boundary: false } : { segment: b, into: a, boundary: true }));
  for (let pass = 0, moved = true; moved && pass < 50; pass++) {
    moved = false;
    for (const move of moves.splice(0)) {
      const content = inner(html, move.segment);
      const at = startOf(html, move.into);
      if (content === null || at < 0) { moves.push(move); continue; }
      let end = elementEnd(html, at);
      if (move.boundary) {
        // The fallback runs from the template to the comment that closes its boundary, boundaries inside it counted.
        const marks = /<!--(\/?)([$&][?!~]?)-->/g;
        marks.lastIndex = end;
        for (let depth = 0, m = marks.exec(html); m; m = marks.exec(html)) {
          if (!m[1]) depth++;
          else if (depth) depth--;
          else { end = m.index; break; }
        }
      }
      html = html.slice(0, at) + content + html.slice(end);
      moved = true;
    }
  }
  return html;
}

/** The elements that start a line of their own in a page's visible text. */
const BLOCK = /^(address|article|aside|blockquote|caption|dd|details|dialog|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|legend|li|main|nav|ol|p|pre|section|summary|table|tbody|tfoot|thead|tr|ul)$/;
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** The attribute that keeps a node out of the text the assistant is sent, as `src/components/patterns/assistant/page-text.ts` reads it. */
const OMIT = /\sdata-assistant=(["']?)omit\1(?=[\s/]|$)/;

/**
 * What the panel reads of an element's markup, as near as a script can without a layout: what `innerText` reads, with
 * no script, style, template, hidden element or node marked `data-assistant="omit"`, a line for each block, a tab
 * between a row's cells, and white space collapsed.
 */
export function visibleText(html: string): string {
  let out = '';
  const tags = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  let last = 0;
  for (let m = tags.exec(html); m; m = tags.exec(html)) {
    out += html.slice(last, m.index).replace(/\s+/g, ' ');
    last = tags.lastIndex;
    const name = m[2]?.toLowerCase();
    if (!name) continue;
    // `hidden` as an attribute, never inside another's value (a class named hidden is not the attribute). A node the
    // page marks `data-assistant="omit"` is left out whole, as the panel leaves it out (`pageText`).
    if (!m[1] && (RAW.has(name) || name === 'template' || name === 'noscript' || /\shidden(?=[\s=]|$)/.test(m[3].replace(/"[^"]*"/g, '""')) || OMIT.test(m[3]))) {
      last = tags.lastIndex = elementEnd(html, m.index);
      continue;
    }
    if (name === 'br') out += '\n';
    else if (m[1] && (name === 'td' || name === 'th')) out += '\t';
    else if (BLOCK.test(name)) out += '\n';
  }
  out += html.slice(last).replace(/\s+/g, ' ');
  return out
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, e: string) => (e[0] === '#' ? String.fromCodePoint(Number(e[1] === 'x' || e[1] === 'X' ? `0${e.slice(1)}` : e.slice(1))) : ENTITIES[e.toLowerCase()] ?? whole))
    .replace(/ *([\n\t]) */g, '$1')
    .replace(/\t+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** A page's title and visible text as the console's panel reads them: `document.title` without the product's name, and the scroll region's text. */
export function pageOf(html: string, product: string): { title: string; text: string } {
  const shown = arrived(html);
  const at = shown.search(/<[a-zA-Z][\w-]*[^>]*\sdata-scroll-region(?=[\s=>])/);
  const region = at < 0 ? '' : shown.slice(at, elementEnd(shown, at));
  const declared = visibleText(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(shown)?.[1] ?? '');
  const suffix = ` · ${product}`;
  const own = declared.endsWith(suffix) ? declared.slice(0, -suffix.length).trim() : declared;
  const h1 = /<h1[^>]*>[\s\S]*?<\/h1>/i.exec(region)?.[0];
  return { title: own && own !== product ? own : visibleText(h1 ?? ''), text: region ? visibleText(region) : '' };
}

/** What a write tool's call came to: the Proposal it raised, the approval asked for it, and how that was answered. */
type Change = { proposal?: { title: string; tone: string; changes: { label: string; from: string; to: string }[] }; approval?: { id: string; reason?: string; automatic?: boolean }; answer?: { approved: boolean; reason?: string }; denied?: boolean };
/** What the assistant did for one question: the tools it called, in order, what each write came to, and its answer. */
type Asked = { question: string; status: number; tools: ({ name: string; input: unknown; output?: unknown; error?: string } & Change)[]; answer: string; errors: string[] };

/** Ask one question of `address` in a thread of its own, with the page the panel would send, and read the UI message stream the route answers. */
async function ask(base: string, cookie: string, address: string, page: { title: string; text: string }, question: string, n: number): Promise<Asked> {
  const body = { messages: [{ id: `ask-${n}`, role: 'user', parts: [{ type: 'text', text: question }] }], page: { path: address, title: page.title, context: '', text: page.text } };
  const res = await fetch(`${base}/api/assistant`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body), signal: AbortSignal.timeout(300_000) });
  const asked: Asked = { question, status: res.status, tools: [], answer: '', errors: [] };
  if (!res.ok) { asked.errors.push(`POST /api/assistant answered ${res.status}`); return asked; }
  type Part = { type?: string; id?: string; toolCallId?: string; toolName?: string; input?: unknown; output?: unknown; delta?: string; errorText?: string; data?: unknown; approvalId?: string; approved?: boolean; reason?: string; isAutomatic?: boolean };
  const parts: Part[] = [];
  for (const line of (await res.text()).split('\n')) {
    if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
    try { parts.push(JSON.parse(line.slice(6))); } catch { continue; }
  }
  // Every call is known before anything said about it is read: a part about a call can stream before the call's input,
  // as `respond()` writes a write's Proposal while its approval is decided, before the step that streams the call.
  const calls = new Map<string, Asked['tools'][number]>();
  for (const part of parts) {
    if (part.type !== 'tool-input-available' || !part.toolCallId) continue;
    const call = { name: String(part.toolName), input: part.input };
    calls.set(part.toolCallId, call);
    asked.tools.push(call);
  }
  const approvals = new Map<string, Asked['tools'][number]>();
  let block: string | undefined;
  for (const part of parts) {
    if (part.type === 'data-proposal' && part.id) {
      // A write tool's preview is keyed by its call, so the Proposal is read beside the call that raised it.
      const call = calls.get(part.id);
      if (call) call.proposal = part.data as Change['proposal'];
    } else if (part.type === 'tool-approval-request' && part.toolCallId && part.approvalId) {
      const call = calls.get(part.toolCallId);
      if (call) {
        call.approval = { id: part.approvalId, ...(part.reason ? { reason: part.reason } : {}), ...(part.isAutomatic ? { automatic: true } : {}) };
        approvals.set(part.approvalId, call);
      }
    } else if (part.type === 'tool-approval-response' && part.approvalId) {
      const call = approvals.get(part.approvalId);
      if (call) call.answer = { approved: part.approved === true, ...(part.reason ? { reason: part.reason } : {}) };
    } else if (part.type === 'tool-output-denied' && part.toolCallId) {
      const call = calls.get(part.toolCallId);
      if (call) call.denied = true;
    } else if (part.type === 'tool-output-available' && part.toolCallId) {
      const call = calls.get(part.toolCallId);
      if (call) call.output = part.output;
    } else if (part.type === 'tool-output-error' && part.toolCallId) {
      const call = calls.get(part.toolCallId);
      if (call) call.error = String(part.errorText);
    } else if (part.type === 'text-delta') {
      // A reply written in more than one block (a step before a tool call and one after) keeps them apart.
      if (block !== undefined && part.id !== block && asked.answer) asked.answer += '\n\n';
      block = part.id;
      asked.answer += part.delta ?? '';
    } else if (part.type === 'error') asked.errors.push(String(part.errorText));
  }
  return asked;
}

/** `body` in a fence longer than any run of backticks inside it. */
function fenced(lang: string, body: string): string {
  const fence = '`'.repeat(Math.max(3, ...[...body.matchAll(/`+/g)].map((m) => m[0].length + 1)));
  return `${fence}${lang}\n${body}\n${fence}`;
}

/**
 * What a tool returned, as a reader reads it: a view's context and a prepared query's answer are text the model was
 * handed, so they are shown as text under the address they came from; anything else as JSON.
 */
function returned(output: unknown): string {
  const o = output as { address?: unknown; context?: unknown; answer?: unknown } | null;
  const text = typeof o?.answer === 'string' ? o.answer : typeof o?.context === 'string' ? o.context : typeof output === 'string' ? output : null;
  if (text === null) return `:\n\n${fenced('json', JSON.stringify(output, null, 2))}`;
  return `${typeof o?.address === 'string' ? `, from ${o.address}` : ''}:\n\n${fenced('text', text)}`;
}

/** What became of a write's approval, in a line: asked and not answered in this thread, approved, or denied and why. */
function settled(t: Change): string[] {
  if (!t.approval && !t.denied) return [];
  const why = (r?: string) => (r ? `: ${r}` : '');
  const line = t.answer
    ? (t.answer.approved ? `Its approval was ${t.approval?.automatic ? 'given by the product' : 'given'}${why(t.answer.reason)}.` : `Its approval was denied${why(t.answer.reason)}.`)
    : t.approval
      ? `Its approval was requested${why(t.approval.reason)} and is not answered in this thread, so the change was not made.`
      : '';
  return [...(line ? [line] : []), ...(t.denied ? ['The tool did not run: the change was not made.'] : []), ''];
}

/** The markdown of one view's questions, as `<folder>/<view>.md` holds it. */
function report(view: View, address: string, persona: string, base: string, page: { title: string; text: string }, asked: Asked[]): string {
  const sent = page.text ? `the page's title "${page.title}" and its visible text as served to ${persona} (${page.text.length} characters)` : `the page's title "${page.title}" and no visible text, as none was served to ${persona}`;
  const out = [
    `# ${view.title}: what the agent does here`,
    '',
    `Asked of ${base}${address} as ${persona}, ${new Date().toISOString()}.`,
    '',
    `Each question was sent with ${sent}; the view's shared context is published in the browser, so it was not sent.`,
  ];
  asked.forEach((a, i) => {
    out.push('', `## ${i + 1}. ${a.question}`, '');
    if (!a.tools.length) out.push('No tool was called.', '');
    for (const t of a.tools) {
      out.push(`Tool \`${t.name}\`, asked:`, '', fenced('json', JSON.stringify(t.input ?? {})), '');
      if (t.proposal) {
        out.push(`It raised the Proposal "${t.proposal.title}" (${t.proposal.tone}):`, '', '| Field | From | To |', '|---|---|---|');
        for (const c of t.proposal.changes) out.push(`| ${[c.label, c.from, c.to].map((v) => String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`);
        out.push('');
      }
      out.push(...settled(t));
      if (t.error !== undefined) out.push('It failed:', '', fenced('text', t.error), '');
      else if (t.output !== undefined) out.push(`It returned${returned(t.output)}`, '');
    }
    for (const e of a.errors) out.push(`Error: ${e}`, '');
    out.push('Answer:', '', a.answer || (a.tools.some((t) => t.proposal) ? '(no text: the Proposal above is the answer)' : '(no answer)'));
  });
  return `${out.join('\n')}\n`;
}

/**
 * The pattern of the addresses a page renders, matched as Next.js matches its route: `[name]` is one segment,
 * `[...name]` one or more, `[[...name]]` zero or more.
 */
export function formOf(page: string): string {
  const seg = `[^/"'?#\\s<>]+`;
  const optional = /\/\[\[\.\.\.[^\]/]+\]\]$/.exec(page);
  const fixed = optional ? page.slice(0, optional.index) : page;
  const form = fixed.split('/').map((s) => (/^\[\.\.\.[^\]/]+\]$/.test(s) ? `${seg}(?:/${seg})*` : /^\[[^\]/]+\]$/.test(s) ? seg : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/');
  // A root optional catch-all renders `/` itself as well as every address under it.
  return optional ? (form ? `${form}(?:/${seg})*` : `(?:/|(?:/${seg})+)`) : form;
}

/**
 * The address a page's questions are asked on: the one `--path` names, the page itself, or for a detail page the first
 * record its listing page links. An optional catch-all (`/docs/[[...path]]`) renders with none of its segments too, so
 * it is asked there.
 */
async function addressOf(base: string, cookie: string, page: string): Promise<string | null> {
  if (!/\[[^\]/]+\]/.test(page)) return page;
  if (/\/\[\[\.\.\.[^\]/]+\]\]$/.test(page)) return addressOf(base, cookie, page.replace(/\/\[\[\.\.\.[^\]/]+\]\]$/, '') || '/');
  const listing = page.split('/[')[0] || '/';
  const html = await (await fetch(`${base}${listing}`, { headers: { cookie }, signal: AbortSignal.timeout(60_000) })).text();
  return new RegExp(`href="(${formOf(page)})(?:[?#][^"]*)?"`).exec(html)?.[1] ?? null;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const arg = (flag: string) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
  const base = arg('--base')?.replace(/\/+$/, '');
  if (!base || !/^https?:\/\//.test(base)) { console.error('usage: node scripts/ask.ts --base <url> [--view <name>] [--path <address>] [--as <persona>] [--out <folder>]'); return 1; }
  const want = arg('--view'), at = arg('--path'), as = arg('--as');
  if (at !== undefined && !at.startsWith('/')) { console.error(`ask: --path takes an address on the product, starting with /: ${at}`); return 1; }
  const folder = path.resolve(arg('--out') ?? path.join(ROOT, 'out/asks'));

  const config = ((await import(pathToFileURL(path.join(ROOT, 'scripts/verify.config.ts')).href)) as { default: { personas?: Personas } }).default;
  const product = ((await import(pathToFileURL(path.join(ROOT, 'src/app.config.ts')).href)) as { app: { name: string } }).app.name;
  const declared = Object.keys(config.personas ?? {});
  const who = personaFor(config, as);
  if (!who.run) {
    // No persona at all is a project that has none to ask as; a name it does not declare is a mistake in the command.
    console.log(`ask: did not run: ${who.why}`);
    return declared.length ? 1 : 0;
  }
  let all: View[];
  try {
    all = views();
  } catch (e) {
    console.error(`ask: ${(e as Error).message}`);
    return 1;
  }
  if (!all.length) { console.error('ask: no page specification lists a question under "### What the agent does here"'); return 1; }
  const { views: chosen, error } = chosenOf(all, want, at);
  if (error) { console.error(`ask: ${error}`); return 1; }

  // Whether the assistant is on, asked with no message: 404 is off; 400, the route refusing the empty thread, or an
  // answer is on. The persona's cookie goes with it, because the route answers 401 to nobody before it says whether it is on.
  let probe: number;
  try {
    probe = (await fetch(`${base}/api/assistant`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: who.cookie }, body: '{"messages":[]}', signal: AbortSignal.timeout(60_000) })).status;
  } catch (e) {
    console.error(`ask: did not run: ${base} could not be reached (${(e as Error).message})`);
    return 1;
  }
  if (probe === 404) { console.log(`ask: did not run: the assistant is off at ${base} (POST /api/assistant answered 404)`); return 0; }
  if (probe !== 400 && (probe < 200 || probe > 299)) { console.error(`ask: did not run: POST /api/assistant answered ${probe} as ${who.persona}`); return 1; }

  let failed = false;
  fs.mkdirSync(folder, { recursive: true });
  for (const view of chosen) {
    const address = at ?? (await addressOf(base, who.cookie, view.page));
    if (!address) {
      console.error(`ask: ${view.name}: no link of the form ${view.page} on ${view.page.split('/[')[0] || '/'}, so its questions were not asked`);
      failed = true;
      continue;
    }
    // The page as this persona is served it, read once: every question on it is asked with the same page.
    const served = await fetch(`${base}${address}`, { headers: { cookie: who.cookie }, signal: AbortSignal.timeout(60_000) }).then((r) => r.text(), () => '');
    const page = pageOf(served, product);
    if (!page.title) page.title = view.title;
    const asked: Asked[] = [];
    // One at a time, in the specification's order: each in a thread of its own, so no answer leans on another's.
    // A question that times out or loses its connection is written as such, and the rest are still asked.
    for (const [i, q] of view.questions.entries()) {
      asked.push(await ask(base, who.cookie, address, page, q, i + 1).catch((e: unknown) => ({ question: q, status: 0, tools: [], answer: '', errors: [(e as Error).message] })));
    }
    const file = path.join(folder, `${view.name}.md`);
    fs.writeFileSync(file, report(view, address, who.persona, base, page, asked));
    const tools = asked.reduce((n, a) => n + a.tools.length, 0);
    const proposals = asked.reduce((n, a) => n + a.tools.filter((t) => t.proposal).length, 0);
    // A Proposal is an answer: the assistant's answer to a request for a change is the change, for the person to approve.
    const unanswered = asked.filter((a) => a.errors.length || !(a.answer || a.tools.some((t) => t.proposal))).length;
    if (unanswered) failed = true;
    const shown = path.relative(process.cwd(), file);
    console.log(`${shown.startsWith('..') ? file : shown}: ${asked.length} questions on ${address} as ${who.persona}, ${tools} tool calls${proposals ? `, ${proposals} Proposal${proposals === 1 ? '' : 's'}` : ''}${unanswered ? `, ${unanswered} not answered` : ''}`);
  }
  return failed ? 1 : 0;
}

if (import.meta.main) process.exitCode = await main();
