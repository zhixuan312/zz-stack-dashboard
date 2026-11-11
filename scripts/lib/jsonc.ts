/** A JSONC document's text with the comments dropped, and whether anything had to be dropped to read it. */
function strippedJsonc(text: string): { json: string; dropped: boolean } {
  const bom = text.charCodeAt(0) === 0xfeff;
  if (bom) text = text.slice(1);
  let out = '';
  let dropped = false;
  for (let i = 0, str = false; i < text.length; i++) {
    const c = text[i];
    if (str) { out += c; if (c === '\\') out += text[++i]; else if (c === '"') str = false; continue; }
    if (c === '"') { str = true; out += c; continue; }
    if (c === '/' && text[i + 1] === '/') { dropped = true; while (i < text.length && text[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && text[i + 1] === '*') { dropped = true; i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; if (i >= text.length) throw new SyntaxError('Unterminated JSONC block comment'); i++; out += ' '; continue; }
    out += c;
  }
  // Consume strings whole before removing trailing commas: their keys and values may themselves contain ",]" or ",}".
  const json = out.replace(/"(?:\\.|[^"\\])*"|,(\s*[}\]])/g, (match, end: string | undefined) => end ?? match);
  return { json, dropped: dropped || json.length !== out.length };
}

/** JSON with the comments and trailing commas a tsconfig may carry. */
export function parseJsonc(text: string): unknown {
  return JSON.parse(strippedJsonc(text).json);
}

/** Whether the document carries comments or trailing commas beyond plain JSON. */
export const jsoncExtras = (text: string) => strippedJsonc(text).dropped;
