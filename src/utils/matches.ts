const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'LIVE', 'EXTRA_TIME', 'PENALTY_SHOOTOUT']);

export const isLiveMatch = (status: string) => LIVE_STATUSES.has(status);

export function localDateString(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function matchDateRange(now = new Date()) {
  const from = new Date(now);
  const to = new Date(now);
  from.setDate(from.getDate() - 3);
  to.setDate(to.getDate() + 10);
  return { from: localDateString(from), to: localDateString(to) };
}

export function matchesPeriod(match: { status: string; utcDate: string }, period: string, now = Date.now()): boolean {
  if (period === 'Todos') return true;
  if (period === 'Ao vivo') return isLiveMatch(match.status);
  if (period === 'Finalizados') return match.status === 'FINISHED';
  return period === 'Próximos' && ['SCHEDULED', 'TIMED'].includes(match.status) && Date.parse(match.utcDate) >= now;
}
