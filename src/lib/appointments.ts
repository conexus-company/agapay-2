import { parseJsonBody, type ApiResult } from '@/lib/api-result';
import type { FacilityHours } from '@/lib/health-navigation-types';
import { isoDateToWeekdayName } from '@/lib/opening-hours';

export type AvailableSchedule = {
  doctorId: string;
  dates: { date: string; isAvailable: boolean; reason?: string }[];
  timeSlots: { date: string; time: string; isAvailable: boolean; reason?: string }[];
};

export type BookingDraft = {
  doctorId: string;
  doctorName: string;
  specialty: string;
  facilityId: string;
  facilityName: string;
  selectedDate: string;
  selectedTime: string;
  // Facility operating hours, carried along so the server can do the
  // authoritative closed-day/outside-hours check itself rather than
  // trusting whatever the client's calendar UI allowed through. Undefined
  // for facilities with no hours data (OSM triage-flow results) — see
  // the comment on `Facility.hours` in health-navigation-types.ts.
  facilityHours?: FacilityHours[];
};

const MOCK_TIME_SLOTS = ['9:00 AM', '10:00 AM', '11:30 AM', '1:00 PM', '2:30 PM', '4:00 PM'];

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseClockToMinutes(value: string): number | null {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatClockTime(value: string): string {
  const minutes = parseClockToMinutes(value);
  if (minutes === null) return value;
  const hour24 = Math.floor(minutes / 60);
  const min = minutes % 60;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(min).padStart(2, '0')} ${period}`;
}

// Fixed appointment slots have no duration field today, so a slot is
// treated as a point-in-time cutoff: it must start at/after opening and
// strictly before closing (a slot starting exactly at close is excluded,
// since it can't run for any duration before the facility closes).
function parseSlotToMinutes(time: string): number | null {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (/pm/i.test(match[3])) hour += 12;
  return hour * 60 + Number(match[2]);
}

function findDayHours(facilityHours: FacilityHours[] | undefined | null, isoDate: string): FacilityHours | undefined {
  if (!facilityHours || facilityHours.length === 0) return undefined;
  const weekday = isoDateToWeekdayName(isoDate);
  if (!weekday) return undefined;
  return facilityHours.find((entry) => entry.day === weekday);
}

/**
 * Checks a single ISO date against the facility's hours for that weekday.
 * Missing hours data (undefined/empty array, or no entry for that specific
 * weekday) is treated as unconstrained — see the fallback note on
 * `getMockAvailableSchedule` below — so facilities without hours data keep
 * behaving exactly as before this validation existed.
 */
function checkDayOpen(facilityHours: FacilityHours[] | undefined | null, isoDate: string): { ok: true } | { ok: false; reason: string } {
  const dayHours = findDayHours(facilityHours, isoDate);
  if (!dayHours) return { ok: true };

  if (dayHours.open === '' && dayHours.close === '') {
    const weekday = isoDateToWeekdayName(isoDate);
    return { ok: false, reason: weekday ? `This facility is closed on ${weekday}s.` : 'This facility is closed on this day.' };
  }

  return { ok: true };
}

function checkSlotWithinHours(
  facilityHours: FacilityHours[] | undefined | null,
  isoDate: string,
  time: string
): { ok: true } | { ok: false; reason: string } {
  const dayHours = findDayHours(facilityHours, isoDate);
  if (!dayHours) return { ok: true };

  const openMinutes = parseClockToMinutes(dayHours.open);
  const closeMinutes = parseClockToMinutes(dayHours.close);
  const slotMinutes = parseSlotToMinutes(time);
  if (openMinutes === null || closeMinutes === null || slotMinutes === null) return { ok: true };

  if (slotMinutes < openMinutes) {
    return { ok: false, reason: `This facility opens at ${formatClockTime(dayHours.open)}.` };
  }
  if (slotMinutes >= closeMinutes) {
    return { ok: false, reason: `This facility closes at ${formatClockTime(dayHours.close)}.` };
  }
  return { ok: true };
}

/**
 * Authoritative date/time-vs-hours check, meant to run server-side (see
 * src/app/appointments/confirm+api.ts) as well as client-side — the
 * calendar/time-slot UI blocking is a UX nicety, not the source of truth,
 * since a client could bypass it and hit the API directly.
 *
 * Known gap: no public-holiday calendar exists in this repo yet, so
 * holiday closures aren't checked here. This is the seam to add that check
 * once a holiday data source exists.
 */
export function validateAppointmentAgainstHours(
  facilityHours: FacilityHours[] | undefined | null,
  isoDate: string,
  time: string
): { ok: true } | { ok: false; reason: string } {
  const dayResult = checkDayOpen(facilityHours, isoDate);
  if (!dayResult.ok) return dayResult;
  return checkSlotWithinHours(facilityHours, isoDate, time);
}

/**
 * MOCK DATA — no slot-availability backend exists yet. Returns every day in
 * referenceDate's calendar month: days before today are unavailable. For
 * later days, availability is cross-referenced against the facility's
 * `hours` (when provided) — a day with empty open/close is closed, and
 * slots outside `[open, close)` are marked unavailable with a reason.
 * When `facilityHours` is undefined/empty (facilities with no hours data,
 * e.g. OSM triage-flow results), every day/slot stays open — the original
 * mock-always-open behavior — so those facilities don't regress.
 */
export function getMockAvailableSchedule(
  doctorId: string,
  facilityHours?: FacilityHours[],
  referenceDate: Date = new Date()
): AvailableSchedule {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = toIsoDate(referenceDate);

  const dates: AvailableSchedule['dates'] = [];
  const timeSlots: AvailableSchedule['timeSlots'] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = toIsoDate(new Date(year, month, day));

    if (date < today) {
      dates.push({ date, isAvailable: false });
      continue;
    }

    const dayResult = checkDayOpen(facilityHours, date);
    if (!dayResult.ok) {
      dates.push({ date, isAvailable: false, reason: dayResult.reason });
      continue;
    }

    dates.push({ date, isAvailable: true });

    for (const time of MOCK_TIME_SLOTS) {
      const slotResult = checkSlotWithinHours(facilityHours, date, time);
      timeSlots.push(slotResult.ok ? { date, time, isAvailable: true } : { date, time, isAvailable: false, reason: slotResult.reason });
    }
  }

  return { doctorId, dates, timeSlots };
}

// Matches the reference design: today is shown outlined but unselected,
// with the next available day pre-selected instead.
export function getDefaultSelectedDate(schedule: AvailableSchedule, referenceDate: Date = new Date()): string | null {
  const today = toIsoDate(referenceDate);
  const availableDates = schedule.dates
    .filter((entry) => entry.isAvailable)
    .map((entry) => entry.date)
    .sort();

  return availableDates.find((date) => date > today) ?? availableDates.find((date) => date === today) ?? availableDates[0] ?? null;
}

export function formatBookingDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Confirms a booking via the existing appointment-confirmation SMS endpoint
 * (src/app/appointments/confirm+api.ts) — there's no separate
 * booking-creation endpoint yet, and that route's own comment says it's
 * meant to be called "the moment a booking is confirmed."
 *
 * Sends `facility_hours` + the raw ISO date alongside the human-readable
 * fields already in use, so the server can run `validateAppointmentAgainstHours`
 * itself instead of trusting the client's calendar UI.
 */
export async function confirmBooking(draft: BookingDraft, profile: unknown): Promise<ApiResult<{ sent: true }>> {
  let response: Response;
  try {
    response = await fetch('/appointments/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        facility_name: draft.facilityName,
        appointment_date: formatBookingDate(draft.selectedDate),
        appointment_date_iso: draft.selectedDate,
        appointment_time: draft.selectedTime,
        facility_hours: draft.facilityHours ?? null,
        profile,
      }),
    });
  } catch {
    return { ok: false, kind: 'network_error' };
  }

  const body = await parseJsonBody(response);

  if (!response.ok) {
    return { ok: false, kind: 'upstream_error', status: response.status, body };
  }

  return { ok: true, data: { sent: true } };
}
