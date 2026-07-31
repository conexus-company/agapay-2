export const SPECIALTIES = [
  'General Practice',
  'Pediatrics',
  'OB-GYN',
  'Dermatology',
  'Orthopedics',
  'Cardiology',
  'Emergency/Urgent Care',
  'Dental',
  'Mental Health',
  'ENT',
  'Ophthalmology',
] as const;

export type Specialty = (typeof SPECIALTIES)[number];

export type TriageResult = {
  specialty: Specialty;
  explanation: string;
  confidence: number;
  is_emergency: boolean;
};

export type FacilityOpenStatus = 'open' | 'closed' | 'unknown';

export type FacilityType = 'Government' | 'Private';

export type Doctor = {
  id: string;
  name: string;
  specialty: string;
  photoUrl?: string;
};

export type FacilityHours = {
  day: string;
  open: string;
  close: string;
};

export type Facility = {
  id: string;
  name: string;
  distanceKm: number;
  openStatus: FacilityOpenStatus;
  lat: number;
  lng: number;
  // The fields below are only populated for facilities sourced from the
  // Healthcare Discovery mock/catalog (Find Facilities list + detail
  // screen), not for OSM-derived results from the AI triage flow.
  icon?: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  address?: string;
  rating?: number;
  isVerified?: boolean;
  hoursToday?: string;
  type?: FacilityType;
  services?: string[];
  doctors?: Doctor[];
  hours?: FacilityHours[];
  phone?: string;
  email?: string;
  website?: string;
};
