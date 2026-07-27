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

export type Facility = {
  id: string;
  name: string;
  distanceKm: number;
  openStatus: FacilityOpenStatus;
  lat: number;
  lng: number;
};
