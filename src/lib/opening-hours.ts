// Minimal reader for a common subset of the OSM `opening_hours` syntax
// (https://wiki.openstreetmap.org/wiki/Key:opening_hours). Only handles
// simple day-range + time-range rules and `24/7`; anything with syntax it
// doesn't recognize (public-holiday modifiers, month ranges, week numbers,
// comments, etc.) returns `null` rather than guessing at a status.
const DAY_CODES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

function expandDays(token: string): number[] | null {
  const parts = token.split(',');
  const days: number[] = [];

  for (const part of parts) {
    const rangeMatch = part.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)-(Mo|Tu|We|Th|Fr|Sa|Su)$/);
    if (rangeMatch) {
      const start = DAY_CODES.indexOf(rangeMatch[1] as (typeof DAY_CODES)[number]);
      const end = DAY_CODES.indexOf(rangeMatch[2] as (typeof DAY_CODES)[number]);
      if (start === -1 || end === -1) return null;
      let i = start;
      while (true) {
        days.push(i);
        if (i === end) break;
        i = (i + 1) % 7;
      }
      continue;
    }

    const singleIndex = DAY_CODES.indexOf(part as (typeof DAY_CODES)[number]);
    if (singleIndex === -1) return null;
    days.push(singleIndex);
  }

  return days;
}

function parseTimeRanges(token: string): [number, number][] | null {
  const ranges: [number, number][] = [];
  for (const part of token.split(',')) {
    const match = part.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
    if (!match) return null;
    const startMin = Number(match[1]) * 60 + Number(match[2]);
    const endMin = Number(match[3]) * 60 + Number(match[4]);
    ranges.push([startMin, endMin]);
  }
  return ranges;
}

export type OpenNowResult = 'open' | 'closed' | 'unknown';

export type WeekHours = { day: string; open: string; close: string };

const WEEK_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function minutesToClock(minutes: number): string {
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const mins = (minutes % 60).toString().padStart(2, '0');
  return `${hours}:${mins}`;
}

/**
 * Expands an OSM `opening_hours` string into a Mon–Sun schedule. Reuses the
 * same day/time-range grammar as `evaluateOpeningHours` above. Returns
 * `null` (rather than guessing) for syntax it doesn't recognize, or for
 * multi-range days (e.g. a lunch break) it collapses to a single
 * earliest-open/latest-close span since the UI only shows one range per day.
 */
export function expandOpeningHoursToWeek(value: string): WeekHours[] | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  if (trimmed === '24/7') {
    return WEEK_DAY_NAMES.map((day) => ({ day, open: '00:00', close: '23:59' }));
  }

  const perDay: ([number, number][] | 'off' | null)[] = new Array(7).fill(null);

  for (const rawRule of trimmed.split(';')) {
    const rule = rawRule.trim();
    if (rule.length === 0) continue;

    const isOff = /\boff\s*$/.test(rule);
    const dayToken = isOff ? rule.replace(/\s*off\s*$/, '').trim() : rule.split(/\s+/)[0];
    const timeToken = isOff ? null : rule.slice(dayToken.length).trim();

    const days = expandDays(dayToken);
    if (days === null) return null;

    if (isOff) {
      for (const day of days) perDay[day] = 'off';
      continue;
    }

    if (!timeToken || timeToken.length === 0) return null;
    const ranges = parseTimeRanges(timeToken);
    if (ranges === null) return null;

    for (const day of days) perDay[day] = ranges;
  }

  return WEEK_DAY_NAMES.map((day, index) => {
    const entry = perDay[index];
    if (!entry || entry === 'off') return { day, open: '', close: '' };
    const open = Math.min(...entry.map(([start]) => start));
    const close = Math.max(...entry.map(([, end]) => end));
    return { day, open: minutesToClock(open), close: minutesToClock(close) };
  });
}

/**
 * Maps an ISO `YYYY-MM-DD` date to its weekday name (`Monday`..`Sunday`),
 * matching the day labels `expandOpeningHoursToWeek` / `FacilityHours.day`
 * use. Computed via `Date.UTC` (not a local `Date` constructor) so the
 * result is independent of the caller's timezone — the client and the
 * server must agree on the same weekday for the same ISO date string.
 */
export function isoDateToWeekdayName(isoDate: string): string | null {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const utcDay = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay();
  return WEEK_DAY_NAMES[(utcDay + 6) % 7];
}

export function evaluateOpeningHours(value: string, now: Date = new Date()): OpenNowResult {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'unknown';
  if (trimmed === '24/7') return 'open';

  const nowDay = (now.getDay() + 6) % 7; // Date#getDay is Sun=0; align to Mo=0
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let matched: OpenNowResult | null = null;

  for (const rawRule of trimmed.split(';')) {
    const rule = rawRule.trim();
    if (rule.length === 0) continue;

    const isOff = /\boff\s*$/.test(rule);
    const dayToken = isOff ? rule.replace(/\s*off\s*$/, '').trim() : rule.split(/\s+/)[0];
    const timeToken = isOff ? null : rule.slice(dayToken.length).trim();

    const days = expandDays(dayToken);
    if (days === null) return 'unknown';
    if (!days.includes(nowDay)) continue;

    if (isOff) {
      matched = 'closed';
      continue;
    }

    if (!timeToken || timeToken.length === 0) return 'unknown';
    const ranges = parseTimeRanges(timeToken);
    if (ranges === null) return 'unknown';

    const withinRange = ranges.some(([start, end]) => nowMinutes >= start && nowMinutes < end);
    matched = withinRange ? 'open' : 'closed';
  }

  return matched ?? 'unknown';
}
