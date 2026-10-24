/**
 * How long any read of the console's may go unanswered, from the moment it is sent, before its page says so: half a
 * second under the spec's five, which is what the phone profile takes to draw that state, so a person sees it within
 * five seconds of the read (spec AC-8.7; measured 111 to 255 ms on 2026-10-14). One bound for every read: each page's
 * first read on the console's server, the browser's later reads (`src/lib/api.ts`) and the identity read
 * (`src/data/gateway.ts`) all take it from here, so none drifts from the others. COUPLED: `scripts/primary-data.ts`
 * holds the screen to five seconds with no allowance.
 *
 * It lives in `src/lib/` because the data layer and the logic layer both read it, and the data layer imports neither
 * logic nor views (the `data-imports-neither` rule).
 */
export const READ_BOUND_MS = 4_500;
