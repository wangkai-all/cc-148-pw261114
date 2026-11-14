export type DateStr = string;

const DAY_MS = 86_400_000;

export function isValidDateStr(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value);
}

export function dateToUtc(date: DateStr): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(date: DateStr, n: number): DateStr {
  const dt = dateToUtc(date);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function diffDays(a: DateStr, b: DateStr): number {
  return Math.round((dateToUtc(b).getTime() - dateToUtc(a).getTime()) / DAY_MS);
}

/** Half-open stay interval: arrival night included, departure day excluded. */
export function stayDates(arrival: DateStr, departure: DateStr): DateStr[] {
  const out: DateStr[] = [];
  const n = diffDays(arrival, departure);
  for (let i = 0; i < n; i++) out.push(addDays(arrival, i));
  return out;
}

export function datesInRange(start: DateStr, endExclusive: DateStr): DateStr[] {
  return stayDates(start, endExclusive);
}

/** Both ends inclusive; used for block capacities and date pickers. */
export function datesInclusive(start: DateStr, endInclusive: DateStr): DateStr[] {
  return stayDates(start, addDays(endInclusive, 1));
}

export function coversDate(start: DateStr, endExclusive: DateStr, date: DateStr): boolean {
  return start <= date && date < endExclusive;
}

export function minDate(a: DateStr, b: DateStr): DateStr {
  return a <= b ? a : b;
}

export function maxDate(a: DateStr, b: DateStr): DateStr {
  return a >= b ? a : b;
}

const weekdayFormatter = new Intl.DateTimeFormat('zh-CN', { weekday: 'short', timeZone: 'UTC' });
const monthDayFormatter = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', timeZone: 'UTC' });
const fullDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
  timeZone: 'UTC',
});

export function weekdayShort(date: DateStr): string {
  return weekdayFormatter.format(dateToUtc(date));
}

export function monthDay(date: DateStr): string {
  return monthDayFormatter.format(dateToUtc(date));
}

export function formatDateFull(date: DateStr): string {
  return fullDateFormatter.format(dateToUtc(date));
}

export function shortDate(date: DateStr): string {
  return date.slice(5).replace('-', '/');
}

export function dateLabel(date: DateStr): string {
  const [, m, d] = date.split('-').map(Number);
  return `${m}月${d}日`;
}

export function formatTimestamp(value: string | undefined): string {
  if (!value) return '—';
  const [date, time] = value.split('T');
  return `${shortDate(date)} ${time ?? ''}`.trim();
}

export function timestampDate(value: string): DateStr {
  return value.slice(0, 10);
}

/** Wall-clock hotel timestamps (YYYY-MM-DDTHH:mm) compare chronologically as strings. */
export function compareTimestamp(a: string, b: string): number {
  return a.localeCompare(b);
}

export function nightsText(n: number): string {
  return `${n} 晚`;
}

export function roomsText(n: number): string {
  return `${n} 间`;
}

export function money(n: number): string {
  return `¥${Math.round(n).toLocaleString('zh-CN')}`;
}
