import type { Facility } from '@/lib/health-navigation-types';

// Static catalog for the Healthcare Discovery module (Find Facilities list +
// Facility Detail screen). Stands in for a facilities backend — swap
// `getFacilityById` / `MOCK_FACILITIES` for real fetch calls once that API
// exists, without changing any screen code that consumes them.
export const MOCK_FACILITIES: Facility[] = [
  {
    id: 'makati-medical-center',
    name: 'Makati Medical Center',
    icon: 'medical-outline',
    address: '2 Amorsolo St, Legazpi Village, Makati',
    distanceKm: 1.2,
    rating: 4.8,
    isVerified: true,
    openStatus: 'open',
    hoursToday: 'Open until 12:00 AM',
    type: 'Private',
    lat: 14.5605,
    lng: 121.0189,
    services: ['Pediatrics', 'Cardiology', 'Emergency', 'Radiology', 'Laboratory', 'Dermatology'],
    doctors: [
      { id: 'd1', name: 'Dr. Amelia Santos', specialty: 'Cardiology' },
      { id: 'd2', name: 'Dr. Ramon Cruz', specialty: 'Pediatrics' },
      { id: 'd3', name: 'Dr. Bianca Reyes', specialty: 'Dermatology' },
    ],
    hours: [
      { day: 'Monday', open: '00:00', close: '23:59' },
      { day: 'Tuesday', open: '00:00', close: '23:59' },
      { day: 'Wednesday', open: '00:00', close: '23:59' },
      { day: 'Thursday', open: '00:00', close: '23:59' },
      { day: 'Friday', open: '00:00', close: '23:59' },
      { day: 'Saturday', open: '00:00', close: '23:59' },
      { day: 'Sunday', open: '00:00', close: '23:59' },
    ],
  },
  {
    id: 'philippine-general-hospital',
    name: 'Philippine General Hospital',
    icon: 'business-outline',
    address: 'Taft Avenue, Ermita, Manila',
    distanceKm: 2.8,
    rating: 4.6,
    isVerified: true,
    openStatus: 'open',
    hoursToday: 'Open until 10:00 PM',
    type: 'Government',
    lat: 14.578,
    lng: 120.9843,
    services: ['Pediatrics', 'OB-GYN', 'Internal Medicine', 'Surgery', 'Emergency', 'Radiology', 'Laboratory'],
    doctors: [
      { id: 'd1', name: 'Dr. Fernando Lopez', specialty: 'Internal Medicine' },
      { id: 'd2', name: 'Dr. Grace Villanueva', specialty: 'OB-GYN' },
      { id: 'd3', name: 'Dr. Miguel Tan', specialty: 'Surgery' },
      { id: 'd4', name: 'Dr. Carmela Ocampo', specialty: 'Pediatrics' },
    ],
    hours: [
      { day: 'Monday', open: '08:00', close: '22:00' },
      { day: 'Tuesday', open: '08:00', close: '22:00' },
      { day: 'Wednesday', open: '08:00', close: '22:00' },
      { day: 'Thursday', open: '08:00', close: '22:00' },
      { day: 'Friday', open: '08:00', close: '22:00' },
      { day: 'Saturday', open: '08:00', close: '18:00' },
      { day: 'Sunday', open: '08:00', close: '18:00' },
    ],
  },
  {
    id: 'ospital-ng-maynila',
    name: 'Ospital ng Maynila',
    icon: 'business-outline',
    address: 'Quirino Ave, Malate, Manila',
    distanceKm: 4.1,
    rating: 4.4,
    isVerified: false,
    openStatus: 'open',
    hoursToday: 'Open 24 hours',
    type: 'Government',
    lat: 14.5764,
    lng: 120.9917,
    services: ['Emergency', 'Internal Medicine', 'Laboratory'],
    // Intentionally empty — exercises the "No information available" empty state on the Doctors tab.
    doctors: [],
    hours: [
      { day: 'Monday', open: '00:00', close: '23:59' },
      { day: 'Tuesday', open: '00:00', close: '23:59' },
      { day: 'Wednesday', open: '00:00', close: '23:59' },
      { day: 'Thursday', open: '00:00', close: '23:59' },
      { day: 'Friday', open: '00:00', close: '23:59' },
      { day: 'Saturday', open: '00:00', close: '23:59' },
      { day: 'Sunday', open: '00:00', close: '23:59' },
    ],
  },
  {
    id: 'st-lukes-medical-center',
    name: "St. Luke's Medical Center",
    icon: 'medical-outline',
    address: '279 E Rodriguez Sr Ave, Quezon City',
    distanceKm: 5.3,
    rating: 4.9,
    isVerified: true,
    openStatus: 'closed',
    hoursToday: 'Closed · Opens 8:00 AM Monday',
    type: 'Private',
    lat: 14.6198,
    lng: 121.0332,
    services: ['OB-GYN', 'Orthopedics', 'Cardiology', 'Radiology'],
    doctors: [
      { id: 'd1', name: 'Dr. Patricia Uy', specialty: 'OB-GYN' },
      { id: 'd2', name: 'Dr. Joel Mendoza', specialty: 'Orthopedics' },
    ],
    hours: [
      { day: 'Monday', open: '08:00', close: '20:00' },
      { day: 'Tuesday', open: '08:00', close: '20:00' },
      { day: 'Wednesday', open: '08:00', close: '20:00' },
      { day: 'Thursday', open: '08:00', close: '20:00' },
      { day: 'Friday', open: '08:00', close: '20:00' },
      { day: 'Saturday', open: '08:00', close: '17:00' },
      // No entry for Sunday — exercises the "Closed" row on the Hours tab.
      { day: 'Sunday', open: '', close: '' },
    ],
  },
];

export function getFacilityById(id: string): Facility | undefined {
  return MOCK_FACILITIES.find((facility) => facility.id === id);
}
