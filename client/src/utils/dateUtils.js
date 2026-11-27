// Shared date helpers for job postings. The "posted X ago" label is derived
// from the stored date every time it renders, so it naturally stays current
// day over day without any backend job needing to rewrite the record.
export function formatPostedDate(dateString) {
  if (!dateString) return 'Unknown';

  const posted = new Date(dateString);
  const diffDays = Math.floor((Date.now() - posted.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Posted today';
  if (diffDays === 1) return 'Posted 1 day ago';
  return `Posted ${diffDays} days ago`;
}

export function formatUpdatedDate(dateString) {
  if (!dateString) return '';

  const updated = new Date(dateString);
  const diffDays = Math.floor((Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Updated today';
  if (diffDays === 1) return 'Updated 1 day ago';
  return `Updated ${diffDays} days ago`;
}

// A due date is a calendar day that the server stores as midnight UTC
// (the date input sends "2026-11-29", saved as 2026-11-29T00:00:00Z).
// Showing it in the browser's time zone moves it back a day for anyone
// west of UTC (in Toronto it would read Nov 28), so it is shown in UTC.
export function formatDueDate(dateString) {
  if (!dateString) return '';

  const due = new Date(dateString);
  return Number.isNaN(due.getTime()) ? '' : due.toLocaleDateString(undefined, { timeZone: 'UTC' });
}
