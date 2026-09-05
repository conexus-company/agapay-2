import { FALLBACK_LEVEL, VERIFICATION_LEVELS } from '@/components/health-profile/verification-badge';
import type { HealthProfile } from '@/lib/health-profile';

export type JourneyEventKind = 'identity' | 'appointment' | 'checkin' | 'update';
export type JourneyEventStatus = 'completed' | 'upcoming' | 'active';

export type JourneyEvent = {
  id: string;
  kind: JourneyEventKind;
  title: string;
  subtitle: string;
  timestamp: string | null; // ISO string; null only for the identity anchor event
  status: JourneyEventStatus;
};

export function buildIdentityEvent(profile: HealthProfile): JourneyEvent {
  const level = VERIFICATION_LEVELS[profile.verification_level] ?? FALLBACK_LEVEL;

  return {
    id: 'identity-verified',
    kind: 'identity',
    title: 'Identity Verified',
    subtitle: `${level.label} · ${profile.full_name ?? 'Citizen'}`,
    timestamp: null,
    status: 'completed',
  };
}

type AppointmentRow = {
  id: string;
  status: string;
  scheduled_at: string;
  service_type: string;
  facility_name: string | null;
};

/**
 * Fetches this citizen's appointments from api/appointments/mine+api.ts,
 * which is scoped to the caller's citizen_hash (fixed in the
 * booking-commitment/digital-queue pass — see mine+api.ts). Falls back to
 * an empty list on any failure rather than showing fake data.
 */
async function fetchAppointmentEvents(citizenToken: string): Promise<JourneyEvent[]> {
  try {
    const res = await fetch('/api/appointments/mine', {
      headers: { Authorization: `Bearer ${citizenToken}` },
    });
    if (!res.ok) return [];

    const body = (await res.json()) as { appointments?: AppointmentRow[] };
    return (body.appointments ?? []).map(mapAppointmentEvent);
  } catch {
    return [];
  }
}

function mapAppointmentEvent(row: AppointmentRow): JourneyEvent {
  const isFuture = new Date(row.scheduled_at).getTime() > Date.now();
  const status: JourneyEventStatus = row.status === 'completed' || row.status === 'no_show' || !isFuture ? 'completed' : 'upcoming';

  const title = row.status === 'no_show' ? 'Appointment Missed' : status === 'upcoming' ? 'Appointment Booked' : 'Appointment Completed';
  const subtitle = row.facility_name ? `${row.service_type} · ${row.facility_name}` : row.service_type;

  return {
    id: `appt-${row.id}`,
    kind: 'appointment',
    title,
    subtitle,
    timestamp: row.scheduled_at,
    status,
  };
}

type CheckinTicketRow = {
  ticket_id: string;
  queue_number: string;
  facility_id: string;
  service_type: string;
  status: 'waiting' | 'called' | 'completed' | 'no_show';
  checked_in_at: string;
  called_at: string | null;
  completed_at: string | null;
};

/**
 * Fetches this citizen's queue-ticket history from
 * api/checkin/my-tickets+api.ts (new — status/[ticketId]+api.ts only looks
 * up one ticket by id, and mine+api.ts only returns the current active
 * ticket, neither of which gives full history for the timeline).
 */
async function fetchCheckinEvents(citizenToken: string): Promise<JourneyEvent[]> {
  try {
    const res = await fetch('/api/checkin/my-tickets', {
      headers: { Authorization: `Bearer ${citizenToken}` },
    });
    if (!res.ok) return [];

    const body = (await res.json()) as { tickets?: CheckinTicketRow[] };
    return (body.tickets ?? []).map(mapCheckinEvent);
  } catch {
    return [];
  }
}

function mapCheckinEvent(row: CheckinTicketRow): JourneyEvent {
  const status: JourneyEventStatus = row.status === 'waiting' || row.status === 'called' ? 'active' : 'completed';
  const title = row.status === 'no_show' ? 'Missed Queue Turn' : row.status === 'completed' ? 'Check-in Completed' : 'Checked In';
  const timestamp = row.completed_at ?? row.called_at ?? row.checked_in_at;

  return {
    id: `checkin-${row.ticket_id}`,
    kind: 'checkin',
    title,
    subtitle: `Queue #${row.queue_number} · ${row.service_type}`,
    timestamp,
    status,
  };
}

/**
 * MOCK DATA — no lab-results/health-updates module exists anywhere in this
 * codebase, and it isn't one of the 8 AGAPAY MVP modules (Auth, Digital
 * Health Identity, Healthcare Navigation, Healthcare Discovery, Appointment,
 * Digital Check-in & Queue, Notifications, Healthcare Journey). Left mocked
 * and out of scope for A-030 — do not wire this to a real source without a
 * dedicated lab-results/health-updates feature backing it.
 */
const MOCK_UPDATE_EVENTS: JourneyEvent[] = [
  {
    id: 'update-1',
    kind: 'update',
    title: 'Lab Results Ready',
    subtitle: 'CBC Panel · view in Health Records',
    timestamp: '2026-07-16T14:00:00+08:00',
    status: 'completed',
  },
  {
    id: 'update-2',
    kind: 'update',
    title: 'Vaccination Reminder',
    subtitle: 'Flu shot due in 2 weeks',
    timestamp: '2026-08-03T08:00:00+08:00',
    status: 'active',
  },
];

/**
 * Builds the full journey timeline: identity (real, from `profile`),
 * appointments and check-ins (real, fetched with `citizenToken` — see
 * fetchAppointmentEvents/fetchCheckinEvents above), and health updates
 * (still mocked, see MOCK_UPDATE_EVENTS). Pass `citizenToken: null` (e.g.
 * while auth is still loading) to skip the appointment/check-in fetches.
 */
export async function buildJourneyTimeline(profile: HealthProfile | null, citizenToken: string | null): Promise<JourneyEvent[]> {
  const [appointmentEvents, checkinEvents] = citizenToken
    ? await Promise.all([fetchAppointmentEvents(citizenToken), fetchCheckinEvents(citizenToken)])
    : [[], []];

  const events = [...appointmentEvents, ...checkinEvents, ...MOCK_UPDATE_EVENTS];
  if (profile) events.push(buildIdentityEvent(profile));

  return events.sort((a, b) => {
    if (a.timestamp === null) return 1;
    if (b.timestamp === null) return -1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}
