/**
 * Reading a drawn table the way a person finds it: by its caption, then a column by its header's words. Every table the
 * console draws is captioned (the DataTable's own rule), so a suite never reaches for a table by its place on the page.
 */

/** An element's classes, an SVG element's included (whose `className` is not a string). */
export const classes = (el: Element) => el.getAttribute('class')?.split(/\s+/) ?? [];

/** The table captioned `caption`: its section, header cells and rows, and by a header's words that column's cells. */
export function captionedTable(caption: string) {
  const t = [...document.querySelectorAll('table')].find((x) => x.querySelector('caption')?.textContent === caption);
  if (!t) throw new Error(`no table captioned "${caption}"; captions: ${[...document.querySelectorAll('caption')].map((c) => c.textContent).join(' | ')}`);
  const heads = [...t.querySelectorAll('thead th')];
  const rows = [...t.querySelectorAll('tbody tr')];
  const at = (header: string) => {
    const index = heads.findIndex((th) => th.textContent?.trim() === header);
    if (index < 0) throw new Error(`no column "${header}" in "${caption}"; columns: ${heads.map((th) => th.textContent?.trim()).join(' | ')}`);
    return { th: heads[index], cells: rows.map((tr) => tr.children[index] as HTMLElement), index };
  };
  return { t, section: t.closest('section')!, heads, rows, at };
}

/** The cells of the column headed `header` in the table captioned `caption`. */
export const column = (caption: string, header: string) => captionedTable(caption).at(header).cells;

/** What a cell draws where the table is a table: a phone's own words for it, and the dot before them, left out. */
export const drawn = (td: Element): Element => td.querySelector(':scope > [class~="@max-[640px]:hidden"]') ?? td;

/** A cell's words as the table draws them. */
export const said = (td: Element) => [...drawn(td).childNodes].filter((n) => !(n instanceof Element && n.hasAttribute('data-sep'))).map((n) => n.textContent).join('');
