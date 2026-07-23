export function resourceLabel(url?: string | null): string {
  if (!url) return 'Unavailable';
  return url.replace(/\/$/, '').split('/').at(-1)?.replaceAll('-', ' ') || url;
}

export function formatPublishedDate(value?: string | null): string {
  if (!value) return '—';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZoneName: 'short', ...(dateOnly ? { timeZone: 'UTC' } : {}),
  }).format(date);
}
