import { parseJsonBody, type ApiResult } from '@/lib/api-result';

export type AvailableSchedule = {
  doctorId: string;
  dates: { date: string; isAvailable: boolean }[];
  timeSlots: { date: string; time: string; isAvailable: boolean }[];
};

export type BookingDraft = {
  doctorId: string;
  doctorName: string;
  specialty: string;
  facilityId: string;
  facilityName: string;
  selectedDate: string;
  selectedTime: string;
};

const MOCK_TIME_SLOTS = ['9:00 AM', '10:00 AM', '11:30 AM', '1:00 PM', '2:30 PM', '4:00 PM'];

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * MOCK DATA — no slot-availability backend exists yet. Returns every day in
 * referenceDate's calendar month: days before today are unavailable, today
 * and every later day are open with all six standard time slots.
 */
export function getMockAvailableSchedule(doctorId: string, referenceDate: Date = new Date()): AvailableSchedule {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = toIsoDate(referenceDate);

  const dates: AvailableSchedule['dates'] = [];
  const timeSlots: AvailableSchedule['timeSlots'] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = toIsoDate(new Date(year, month, day));
    const isAvailable = date >= today;
    dates.push({ date, isAvailable });
    if (isAvailable) {
      for (const time of MOCK_TIME_SLOTS) {
        timeSlots.push({ date, time, isAvailable: true });
      }
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
        appointment_time: draft.selectedTime,
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
