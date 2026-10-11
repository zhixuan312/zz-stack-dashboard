import type { ReactNode } from 'react';

/**
 * Holds hyphenated identifiers such as eu-west-1 or rly_live_7Hc2-q91 on one line: a break after the hyphen reads as
 * two words. The hyphen stays a real hyphen, so copying and find-in-page still match. Only a token up to 24
 * characters is held, so a long path still wraps on a phone. Anything but a string passes through unchanged.
 */
export function keepHyphenated(text: ReactNode): ReactNode {
  if (typeof text !== 'string' || !text.includes('-')) return text;
  return text.split(/(\S+-\S+)/).map((part, i) => (i % 2 && part.length <= 24 ? <span key={i} className="whitespace-nowrap">{part}</span> : part));
}
