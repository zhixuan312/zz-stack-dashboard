/**
 * Cumulative Layout Shift, as web-vitals defines it: the largest session window of shifts no input caused.
 *
 * A session window opens on a shift and keeps taking shifts while each lands within 1 s of the one before it AND within
 * 5 s of the window's own first shift; the score is the largest window's sum, not the page's total (issue #90). Both
 * bounds are the definition. With the 1 s gap alone, a page whose content arrives in small pieces — a table filling in,
 * rows arriving — over half a minute reports one session the length of the page: it fails a page that is inside the
 * budget, and its number cannot be compared with any other tool's.
 *
 * The body below is source, not a function: it is the layout-shift observer's body, added to the page before any page
 * script runs (`scripts/vitals.ts`). It reads the shift entry as `e` and the accumulator as `v`, both the observer's own
 * names — `v.started` is the window's first shift, `v.session` its sum, `v.last` the shift before this one.
 * `tests/cli-vitals-cls.test.ts` builds the same text into a function so what it proves is what the page runs.
 */
export const CLS_SESSION = `
    if (!v.session || e.startTime - v.last >= 1000 || e.startTime - v.started >= 5000) { v.started = e.startTime; v.session = e.value; }
    else v.session += e.value;
    v.last = e.startTime;
    v.cls = Math.max(v.cls, v.session);`;
