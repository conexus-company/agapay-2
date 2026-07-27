const MS_PER_DAY = 86_400_000;

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Foundational';

  const diffDays = Math.round((Date.now() - new Date(iso).getTime()) / MS_PER_DAY);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays === -1) return 'Tomorrow';
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < -1 && diffDays > -7) return `In ${-diffDays} days`;

  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}
