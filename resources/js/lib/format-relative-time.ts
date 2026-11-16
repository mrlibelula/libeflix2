/**
 * Format an ISO timestamp as a short relative string (e.g. "2h ago").
 */
export function formatRelativeTime(isoDate?: string | null): string | null {
  if (!isoDate) {
    return null;
  }

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const diffMs = Date.now() - date.getTime();
  const diffSeconds = Math.round(diffMs / 1000);

  if (diffSeconds < 60) {
    return 'Just now';
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays}d ago`;
  }

  const diffMonths = Math.round(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths}mo ago`;
  }

  const diffYears = Math.round(diffDays / 365);
  return `${diffYears}y ago`;
}

/**
 * Format an ISO timestamp for tooltips / absolute display.
 */
export function formatAbsoluteDateTime(isoDate?: string | null): string | null {
  if (!isoDate) {
    return null;
  }

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
