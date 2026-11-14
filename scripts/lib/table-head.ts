/** A table head that draws a box on a phone is a header a reader sees as stray words; it must be visually hidden. */
export function phoneHeadProblem(width: number, height: number, insideSrOnly: boolean): string | null {
  return width < 640 && !insideSrOnly && height > 1 ? `a table head draws ${Math.round(height)}px on a phone` : null;
}
