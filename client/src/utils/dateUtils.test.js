// SCRUM-373: Unit tests for the shared job date helpers, including the
// due date display used by the job list, recommendations and recruiter postings.
import { formatDueDate, formatPostedDate, formatUpdatedDate } from './dateUtils';

const DAY = 24 * 60 * 60 * 1000;

describe('formatDueDate', () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it('returns an empty string when there is no due date or it is invalid', () => {
    expect(formatDueDate(null)).toBe('');
    expect(formatDueDate('')).toBe('');
    expect(formatDueDate('not-a-date')).toBe('');
  });

  it.each(['America/Toronto', 'America/Vancouver', 'UTC', 'Asia/Tokyo'])(
    'shows the day the recruiter picked for a user in %s',
    (timeZone) => {
      process.env.TZ = timeZone;
      // Noon UTC on Nov 29 is Nov 29 in every one of these time zones.
      const expected = new Date(Date.UTC(2026, 10, 29, 12)).toLocaleDateString(undefined, { timeZone: 'UTC' });

      expect(formatDueDate('2026-11-29T00:00:00.000Z')).toBe(expected);
    }
  );

  it('does not move the due date back a day in Toronto', () => {
    process.env.TZ = 'America/Toronto';
    const dayBefore = new Date(Date.UTC(2026, 10, 28, 12)).toLocaleDateString(undefined, { timeZone: 'UTC' });

    expect(formatDueDate('2026-11-29T00:00:00.000Z')).not.toBe(dayBefore);
  });
});

describe('formatPostedDate and formatUpdatedDate', () => {
  it('handles a missing date', () => {
    expect(formatPostedDate(null)).toBe('Unknown');
    expect(formatUpdatedDate(null)).toBe('');
  });

  it.each([
    [0, 'Posted today', 'Updated today'],
    [1, 'Posted 1 day ago', 'Updated 1 day ago'],
    [5, 'Posted 5 days ago', 'Updated 5 days ago'],
  ])('labels a date %i day(s) ago', (daysAgo, posted, updated) => {
    const date = new Date(Date.now() - daysAgo * DAY - 1000).toISOString();

    expect(formatPostedDate(date)).toBe(posted);
    expect(formatUpdatedDate(date)).toBe(updated);
  });
});
