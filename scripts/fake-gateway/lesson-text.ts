/**
 * The fake gateway's lesson text: what each lesson on every shelf says, so a lesson opened reads as the lesson its
 * title names, what was found and what to do, and its excerpt is the first of those.
 *
 * Read by work.ts and work-knowledge.ts, which hold the lessons themselves; this file imports neither, so both can.
 */

/** `[what happened, what to do, a command to run]`, by `<team>/<number>`. */
const TEXT: Record<string, [found: string, todo: string, run?: string]> = {
  'atlas/0001': ['The onboarding review accepted a checklist saying the setup script worked; the first new starter found it failed on a clean machine.',
    'Before a review cites an artifact as working, run it on a clean checkout and paste the command and its exit code.', 'pnpm verify'],
  'atlas/0002': ['A model-written reason for a match read well in the demo, and named a field the result did not contain in 1 of 9 queries checked.',
    'Take a result\'s reason from the fields the index matched, and show none when the index records none.'],
  'atlas/0003': ['Six onboarding events were logged for two weeks before anyone asked a new starter; the step they stalled on was never logged.',
    'Talk to three people who just did the thing before choosing what to log.'],
  'atlas/0004': ['Newest first looked right on a young index; once it held a year of documents, the answer was on page three for most queries.',
    'Superseded by 0005: rank by relevance, and let recency only break a tie.'],
  'atlas/0005': ['With relevance first, the result people opened moved from row 7 to row 2 on the sample queries; recency still decided between near-equal ones.',
    'Sort by the relevance score, and compare the updated date only when two scores are equal to two decimals.'],
  'atlas/0006': ['The longest searches, mostly pasted error messages, were missing from every analysis: the logger truncates them and then discards them.',
    'Read long queries from the request log, and say in any analysis that the query log leaves them out.'],
  'atlas/0007': ['A 300 ms budget for the whole request hid that the ranking hop alone took 240 ms at the 95th percentile.',
    'Give each hop its own budget, and alert on the hop that breaks it rather than on the request.'],
  'atlas/0008': ['Paraphrased explanations drifted from the matched text, and people stopped trusting them after one wrong one.',
    'Show the matched words exactly as the index holds them, highlighted in place.'],
  'atlas/0009': ['Brought in from the research team\'s usability study: 92% of clicks landed on the first five rows of a result list.',
    'Put what matters in the first five rows; never rely on the sixth being seen.'],
  'atlas/0010': ['Brought in from the writing guide: readers misread unlabelled figures, a share taken for a count.',
    'Label every figure with what it counts and of what, "12 of 16 searches" rather than "75%".'],
  'atlas/0011': ['Re-indexing on every write doubled the write latency and still left the index minutes behind during a bulk import.',
    'Re-index once a night, and mark a result as possibly stale when its document changed since.'],
  'atlas/0012': ['Two snippets made from a draft quoted a sentence that was removed before the document was approved.',
    'Have a person read each new snippet template against three real documents before it goes live.'],
  'beacon/0001': ['Editing a settled payment to refund it broke the daily reconciliation twice in one month.',
    'Record a refund as a new entry pointing at the payment it returns, and never change the payment.'],
  'beacon/0002': ['A chargeback arrived 117 days after its payment, after the alert window had closed and the order was archived.',
    'Keep a payment\'s records and its alert window open for 120 days after it settles.'],
  'beacon/0003': ['A threshold of ten chargebacks a day paged on every sale weekend and stayed silent through a slow rise.',
    'Alert when the seven-day rate rises above its four-week median, not on a day\'s count.'],
  'cinder/0001': ['The failover runbook named a host that had been renamed, and nobody noticed until the outage it was written for.',
    'Rehearse each runbook once a quarter, and fix what the rehearsal finds the same day.'],
  'zz-platform/0001': ['Three teams recorded the same lesson about query latency within a month, none of them aware of the others.',
    'Search the shared shelf for the lesson\'s title before adding it, and supersede the older one when you find it.'],
  'zz-platform/0002': ['A green check was taken for an approval, and a spec nobody had agreed went to build.',
    'Record a gate only when a named person approves the revision; a check is evidence for that person, never the approval.'],
};

/** The lesson `num` of `team`, titled `title`, as its body reads: what happened and what to do, and the command when
 *  it names one. */
export function lessonBody(team: string, num: string, title: string): string {
  const [found, todo, run] = TEXT[`${team}/${num}`] ?? [`${title} was learned on ${team}'s work.`, 'Read the evidence before you build on it.'];
  return `\n${title}.\n\n- **What happened.** ${found}\n- **What to do.** ${todo}\n${run ? `\n\`\`\`sh\n${run}\n\`\`\`\n` : ''}`;
}

/** The lesson's excerpt, as a list row shows it: its title and what happened. */
export function lessonExcerpt(team: string, num: string, title: string): string {
  return `${title}. ${TEXT[`${team}/${num}`]?.[0] ?? ''}`.trim();
}
