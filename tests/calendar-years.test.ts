import { describe, expect, it } from 'vitest';
import { formatCalendarDate, formatCalendarMonth, formatDate, formatDay, formatShortDate } from '@/lib/format-date';

/** Calendar dates keep their own year; JavaScript's numeric date constructors reinterpret 0–99 as 1900–1999. */
describe('calendar dates before year 100', () => {
  it.each([
    ['0001-01-01', '01 Jan 1', '1 Jan', 'Mon 1 Jan 1'],
    ['0099-12-31', '31 Dec 99', '31 Dec', 'Thu 31 Dec 99'],
    ['0100-01-01', '01 Jan 100', '1 Jan', 'Fri 1 Jan 100'],
  ])('prints %s as its own calendar date', (input, full, day, weekday) => {
    expect(formatDate(input)).toBe(full);
    expect(formatDay(input)).toBe(day);
    expect(formatShortDate(input)).toBe(full.slice(0, 6));
    expect(formatCalendarDate(input)).toBe(weekday);
    expect(formatCalendarMonth(input)).toBe(full.slice(3, 6));
  });
});
