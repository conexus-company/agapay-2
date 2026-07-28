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

/**
 * MOCK DATA — placeholder events pending the real Appointment, Digital
 * Check-in/Queue, and Notifications modules. Replace each block with a live
 * fetch once those features exist; nothing else about the timeline needs to
 * change since buildJourneyTimeline() just merges whatever arrives here.
 */
const MOCK_APPOINTMENT_EVENTS: JourneyEvent[] = [
  {
    id: 'appt-1',
    kind: 'appointment',
    title: 'Appointment Booked',
    subtitle: 'General Consultation · Quezon City Health Center',
    timestamp: '2026-07-31T09:00:00+08:00',
    status: 'upcoming',
  },
  {
    id: 'appt-2',
    kind: 'appointment',
    title: 'Appointment Completed',
    subtitle: 'Annual Check-up · Manila District Hospital',
    timestamp: '2026-07-14T10:30:00+08:00',
    status: 'completed',
  },
];

const MOCK_CHECKIN_EVENTS: JourneyEvent[] = [
  {
    id: 'checkin-1',
    kind: 'checkin',
    title: 'Checked In',
    subtitle: 'Queue #A-042 · Manila District Hospital',
    timestamp: '2026-07-14T10:15:00+08:00',
    status: 'completed',
  },
];

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

export const MOCK_JOURNEY_EVENTS: JourneyEvent[] = [
  ...MOCK_APPOINTMENT_EVENTS,
  ...MOCK_CHECKIN_EVENTS,
  ...MOCK_UPDATE_EVENTS,
];

export function buildJourneyTimeline(profile: HealthProfile | null): JourneyEvent[] {
  const events = profile ? [...MOCK_JOURNEY_EVENTS, buildIdentityEvent(profile)] : [...MOCK_JOURNEY_EVENTS];

  return events.sort((a, b) => {
    if (a.timestamp === null) return 1;
    if (b.timestamp === null) return -1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}
