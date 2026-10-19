/**
 * Access's tables as a phone reads them. Under 512px of table a row is a card: its lead cell (the one marked
 * `data-lead`) whole on its own line, and the cells after it on the next, the last at the far end. A table's columns at
 * that width set an address one word a line beside a 230px control; a card gives it the line. Rows are flex boxes, so
 * their cells are flex items whatever their own display, and a column the table drops (`hideBelow`) stays dropped.
 * Literal strings, so Tailwind finds them.
 */
export const PHONE_ROWS = [
  '@max-[512px]:block @max-[512px]:[&>thead]:hidden @max-[512px]:[&>tbody]:block',
  '@max-[512px]:[&_tr]:flex @max-[512px]:[&_tr]:flex-wrap @max-[512px]:[&_tr]:items-center @max-[512px]:[&_tr]:gap-x-3 @max-[512px]:[&_tr]:gap-y-2',
  '@max-[512px]:[&_tr]:border-b @max-[512px]:[&_tr]:border-line @max-[512px]:[&_tr:last-child]:border-0 @max-[512px]:[&_tr]:px-(--card-pad) @max-[512px]:[&_tr]:py-3',
  '@max-[512px]:[&_td]:!h-auto @max-[512px]:[&_td]:!border-0 @max-[512px]:[&_td]:!p-0 @max-[512px]:[&_td[data-lead]]:basis-full @max-[512px]:[&_td:last-child]:ml-auto',
].join(' ');

/**
 * An email address kept whole on a line, and broken only after its `@` where the line is shorter than the address: an
 * inline block moves to the next line whole when it fits there, so "mcp oauth — /core/mcp — ava@example.com" never ends
 * a line at "ava@example" and starts the next at ".com". A part longer than the whole line may still break, as a last
 * resort. The parts are text nodes of one element, so the address reads, selects and copies as one.
 */
export function Email({ address }: { address: string }) {
  const at = address.indexOf('@') + 1;
  return (
    <span className="inline-block max-w-full [overflow-wrap:break-word]">
      {at > 0 ? <>{address.slice(0, at)}<wbr />{address.slice(at)}</> : address}
    </span>
  );
}
