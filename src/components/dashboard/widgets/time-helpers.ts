/**
 * Shared time-ago utility for dashboard widgets.
 * Replaces duplicated timeAgo / getRelativeTime helpers.
 */
export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return 'nunca';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
