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
