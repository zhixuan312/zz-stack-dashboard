/**
 * What spent a dropped frame, said in one clause: the longest gap between animation frames, and whether the main thread
 * was busy through it. A long animation frame (Chrome 123+) splits that busy time into script, style and layout, and
 * render. It is a module of its own because scripts/vitals.ts starts Chrome when it is imported.
 */

/** One long animation frame, in whole milliseconds. */
export type Loaf = { duration: number; script: number; layout: number; render: number; invoker: string };

/** The fields a long-animation-frame entry carries that this reads; the page records them as they are. */
export type LoafEntry = {
  startTime: number;
  duration: number;
  renderStart: number;
  styleAndLayoutStart: number;
  scripts: { invoker: string; duration: number; forcedStyleAndLayoutDuration: number }[];
};

/** The split of one entry: scripts summed, style and layout (forced inside scripts plus its own), and render. */
export function loafOf(e: LoafEntry): Loaf {
  const end = e.startTime + e.duration;
  const script = e.scripts.reduce((n, s) => n + s.duration, 0);
  const ownLayout = e.styleAndLayoutStart ? end - e.styleAndLayoutStart : 0;
  const layout = e.scripts.reduce((n, s) => n + s.forcedStyleAndLayoutDuration, 0) + ownLayout;
  const render = e.renderStart ? end - e.renderStart - ownLayout : 0;
  const longest = e.scripts.reduce<LoafEntry['scripts'][number] | null>((a, s) => (!a || s.duration > a.duration ? s : a), null);
  return {
    duration: Math.round(e.duration),
    script: Math.round(script),
    layout: Math.round(layout),
    render: Math.round(render),
    invoker: (longest?.invoker ?? '').slice(0, 60),
  };
}

/** The clause for the longest gap of a tap that dropped a frame, from the long animation frames recorded in that tap. */
export function frameCause(gap: number, loafs: Loaf[]): string {
  const longest = loafs.reduce<Loaf | null>((a, l) => (!a || l.duration > a.duration ? l : a), null);
  if (!longest) return `longest gap ${gap} ms: no long animation frame (the main thread was not busy; the compositor or the host)`;
  return `longest gap ${gap} ms: a long animation frame of ${longest.duration} ms (script ${longest.script} ms by ${longest.invoker}, style and layout ${longest.layout} ms, render ${longest.render} ms)`;
}
