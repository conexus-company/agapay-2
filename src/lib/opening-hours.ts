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
