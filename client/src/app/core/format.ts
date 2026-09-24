import { EventSnapshot } from './models';

// All event times are shown in India time, wherever the visitor is.
const TZ = 'Asia/Kolkata';
const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-IN', { timeZone: TZ, ...options });
const weekdayFmt = part({ weekday: 'short' });
const dayFmt = part({ day: '2-digit' });
const monthFmt = part({ month: 'short' });
const timeFmt = part({ hour: 'numeric', minute: '2-digit', hour12: true });
const longFmt = part({ weekday: 'long', day: 'numeric', month: 'long' });
const fullFmt = part({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
const keyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }); // YYYY-MM-DD

export const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** "Sat, 28 Sep" */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${weekdayFmt.format(d)}, ${dayFmt.format(d)} ${monthFmt.format(d).slice(0, 3)}`;
}
export const timeOf = (iso: string) => timeFmt.format(new Date(iso)).toUpperCase();
export const longDate = (iso: string) => longFmt.format(new Date(iso));
export const fullDateTime = (iso: string) => fullFmt.format(new Date(iso));
export const dayParts = (iso: string) => {
  const d = new Date(iso);
  return { day: dayFmt.format(d), month: monthFmt.format(d).slice(0, 3).toUpperCase(), weekday: weekdayFmt.format(d).toUpperCase() };
};

/** Calendar day in India as YYYY-MM-DD. */
export const dayKey = (date: Date | string) => keyFmt.format(new Date(date));

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(toKey) - Date.parse(fromKey)) / 86_400_000);
}

/** "Today", "Tomorrow", "In 5 days", or '' for later dates. */
export function relativeDay(iso: string, now = new Date()): string {
  const diff = daysBetween(dayKey(now), dayKey(iso));
  if (diff < 0) return 'Ended';
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 7) return `In ${diff} days`;
  return '';
}

export type DateFilter = 'Any date' | 'Today' | 'Tomorrow' | 'This weekend' | 'Next 7 days' | 'Next 30 days';
export const DATE_FILTERS: DateFilter[] = ['Any date', 'Today', 'Tomorrow', 'This weekend', 'Next 7 days', 'Next 30 days'];

export function matchesDateFilter(iso: string, filter: DateFilter, now = new Date()): boolean {
  const diff = daysBetween(dayKey(now), dayKey(iso));
  switch (filter) {
    case 'Any date':
      return true;
    case 'Today':
      return diff === 0;
    case 'Tomorrow':
      return diff === 1;
    case 'Next 7 days':
      return diff >= 0 && diff < 7;
    case 'Next 30 days':
      return diff >= 0 && diff < 30;
    case 'This weekend': {
      const weekday = weekdayFmt.format(now); // Mon … Sun
      const toSat = { Mon: 5, Tue: 4, Wed: 3, Thu: 2, Fri: 1, Sat: 0, Sun: -1 }[weekday] ?? 0;
      return diff >= Math.max(0, toSat) && diff <= toSat + 1;
    }
  }
}

export function durationLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h && `${h} hr`, m && `${m} min`].filter(Boolean).join(' ');
}

/** Requests an image at the size it's shown (×2 for sharp high-DPI screens) from CDNs that support it. */
export function sizedImage(url: string, width: number): string {
  if (!/^https:\/\/images\.unsplash\.com\//.test(url)) return url;
  const w = Math.min(2400, Math.round(width * Math.min(2, typeof devicePixelRatio === 'number' ? devicePixelRatio || 1 : 1) * 1.25));
  return `${url}${url.includes('?') ? '&' : '?'}w=${w}`;
}

/**
 * Inline style for poster art: an uploaded image, or a tile of the 4×3 event atlas.
 * The stylesheet turns --col/--row into an undistorted crop for any box shape.
 */
export function posterStyle(event: Pick<EventSnapshot, 'art' | 'imageUrl'>, width = 800): Record<string, string> {
  if (event.imageUrl) return { '--poster-img': `url("${sizedImage(event.imageUrl, width)}")` };
  const art = event.art ?? 0;
  return { '--col': String(art % 4), '--row': String(Math.floor(art / 4)) };
}

export type Availability = { label: string; tone: 'hot' | 'warn' | 'out' | 'ok' } | null;

export function availability(event: { seatsLeft: number; capacity: number }): Availability {
  if (event.seatsLeft <= 0) return { label: 'Sold out', tone: 'out' };
  const ratio = event.seatsLeft / event.capacity;
  if (event.seatsLeft <= 12 || ratio < 0.1) return { label: `Only ${event.seatsLeft} left`, tone: 'hot' };
  if (ratio < 0.35) return { label: 'Selling fast', tone: 'warn' };
  return null;
}

const CATEGORY_LABELS: Record<string, string> = {
  'LIVE MUSIC': 'Live music',
  THEATRE: 'Theatre',
  COMEDY: 'Comedy',
  SPORT: 'Sport',
  MOVIE: 'Movie',
  FOOD: 'Food & drink',
  WORKSHOP: 'Workshop',
  DANCE: 'Dance',
  ART: 'Art',
  EXHIBITION: 'Exhibition',
};
export const categoryLabel = (type: string) => CATEGORY_LABELS[type] ?? type;

/** Two-letter initials from a name. */
export const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

/** "Starts in 2d 4h", "Starts in 45m", "Happening now", relative to `now`. */
export function countdownLabel(startsAt: string, endsAt: string, now: number): string {
  const start = Date.parse(startsAt);
  if (now >= start) return now < Date.parse(endsAt) ? 'Happening now' : 'Ended';
  const mins = Math.floor((start - now) / 60_000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d >= 7) return '';
  if (d) return `Starts in ${d}d ${h}h`;
  if (h) return `Starts in ${h}h ${m}m`;
  return `Starts in ${m}m`;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}
