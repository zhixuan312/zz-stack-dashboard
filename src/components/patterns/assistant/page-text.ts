/** A node the assistant never reads: a value shown once, such as a new key's secret, is drawn so marked. */
export const OMIT = '[data-assistant="omit"]';

/**
 * The visible text of `region`, as the assistant is sent it, without any node marked `data-assistant="omit"`. Each such
 * node is taken out of the layout for this one synchronous read and put back as it was, so nothing is painted without
 * it, and the text keeps the line breaks and the hidden parts `innerText` gives.
 */
export function pageText(region: HTMLElement): string {
  const omitted = [...region.querySelectorAll<HTMLElement>(OMIT)].map((el) => ({ el, value: el.style.getPropertyValue('display'), priority: el.style.getPropertyPriority('display') }));
  for (const { el } of omitted) el.style.setProperty('display', 'none', 'important');
  try {
    return region.innerText ?? '';
  } finally {
    for (const { el, value, priority } of omitted) {
      if (value) el.style.setProperty('display', value, priority);
      else el.style.removeProperty('display');
      if (!el.getAttribute('style')) el.removeAttribute('style');
    }
  }
}
