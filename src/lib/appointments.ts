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

// Named so product can tune without hunting for a magic number. Cancelling
// at least this many hours before scheduled_at releases/refunds the
// booking commitment; cancelling later forfeits it.
export const CANCELLATION_WINDOW_HOURS = 24;

// Placeholder micro-deposit amount — no payment gateway is wired yet (see
// roadmap "eGovPay"), so this is a hold amount for the state machine, not
// a real charge.
export const BOOKING_COMMITMENT_AMOUNT_PHP = 50;

// How long a held-but-not-yet-captured commitment reserves the slot for.
// Capture today is immediate (see booking_commitments migration comment),
// so this mostly documents intent for when real async payment capture
// replaces the instant-capture stub.
export const BOOKING_HOLD_WINDOW_MINUTES = 10;

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

function parseSlotClock(time: string): { hour: number; minute: number } | null {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (/pm/i.test(match[3])) hour += 12;
  return { hour, minute: Number(match[2]) };
}

// Fixed appointment slots have no duration field today, so a slot is
// treated as a point-in-time cutoff: it must start at/after opening and
// strictly before closing (a slot starting exactly at close is excluded,
// since it can't run for any duration before the facility closes).
function parseSlotToMinutes(time: string): number | null {
  const clock = parseSlotClock(time);
  return clock ? clock.hour * 60 + clock.minute : null;
}

/**
 * Combines a calendar date with a display slot time (e.g. "2:30 PM") into
 * the ISO timestamp book+api.ts expects as scheduled_at. Interprets both in
 * local wall-clock time, matching how the rest of this file already builds
 * dates (toIsoDate, formatBookingDate).
 */
export function combineDateAndSlot(isoDate: string, time: string): string | null {
  const clock = parseSlotClock(time);
  if (!clock) return null;
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day, clock.hour, clock.minute).toISOString();
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

/**
 * Fetches this doctor's already-taken slots at this facility (any
 * non-cancelled appointment) from api/appointments/availability+api.ts, so
 * the calendar UI can gray them out before the citizen even tries to book.
 * This is a UX nicety, not the source of truth — the DB unique index
 * (appointments_active_slot_lock) is what actually prevents a double-book,
 * so a failure here just falls back to showing everything open.
 */
export async function fetchBookedSlots(facilityId: string, doctorId: string): Promise<Set<string>> {
  try {
    const response = await fetch(
      `/api/appointments/availability?facility_id=${encodeURIComponent(facilityId)}&doctor_id=${encodeURIComponent(doctorId)}`
    );
    if (!response.ok) return new Set();
    const body = (await parseJsonBody(response)) as { booked?: unknown } | null;
    const booked = body && Array.isArray(body.booked) ? body.booked : [];
    return new Set(booked.filter((value): value is string => typeof value === 'string'));
  } catch {
    return new Set();
  }
}

/** Overlays already-booked ISO timestamps onto a mock schedule's time slots. */
export function applyBookedSlots(schedule: AvailableSchedule, booked: Set<string>): AvailableSchedule {
  if (booked.size === 0) return schedule;

  const timeSlots = schedule.timeSlots.map((slot) => {
    if (!slot.isAvailable) return slot;
    const iso = combineDateAndSlot(slot.date, slot.time);
    if (iso && booked.has(iso)) {
      return { ...slot, isAvailable: false, reason: 'This slot is already booked.' };
    }
    return slot;
  });

  return { ...schedule, timeSlots };
}

export function formatBookingDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Sends the appointment-confirmed SMS via the existing eMessage endpoint
 * (src/app/appointments/confirm+api.ts). Sequenced alongside — not instead
 * of — `bookAppointment` below, which is the one that actually persists the
 * booking.
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

export type BookedAppointment = {
  appointment_id: string;
  reference_number: string;
  status: string;
  scheduled_at: string;
  commitment: { status: string; amount_php: number };
};

/**
 * Persists the booking via api/appointments/book+api.ts, which also runs
 * the booking-commitment hold/capture step and enforces the real-time
 * doctor+facility+time slot lock. `citizenToken` is sent as a bearer token
 * the same way every other placeholder-auth route in this codebase expects
 * one (see resolveSsoSubjectId in lib/health-profile.ts, used by callers as
 * the stable per-citizen id).
 */
export async function bookAppointment(draft: BookingDraft, citizenToken: string): Promise<ApiResult<BookedAppointment>> {
  const scheduledAt = combineDateAndSlot(draft.selectedDate, draft.selectedTime);
  if (!scheduledAt) {
    return { ok: false, kind: 'invalid_response', message: 'Could not resolve the selected date and time.' };
  }

  let response: Response;
  try {
    response = await fetch('/api/appointments/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` },
      body: JSON.stringify({
        facility_id: draft.facilityId,
        doctor_id: draft.doctorId,
        service_type: draft.specialty,
        scheduled_at: scheduledAt,
      }),
    });
  } catch {
    return { ok: false, kind: 'network_error' };
  }

  const body = await parseJsonBody(response);

  if (!response.ok) {
    return { ok: false, kind: 'upstream_error', status: response.status, body };
  }

  return { ok: true, data: body as BookedAppointment };
}
