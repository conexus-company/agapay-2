import type { Ionicons } from '@expo/vector-icons';

import type { Specialty } from '@/lib/health-navigation-types';

export const SPECIALTY_ICONS: Record<Specialty, keyof typeof Ionicons.glyphMap> = {
  'General Practice': 'medical-outline',
  Pediatrics: 'body-outline',
  'OB-GYN': 'woman-outline',
  Dermatology: 'hand-left-outline',
  Orthopedics: 'walk-outline',
  Cardiology: 'heart-outline',
  'Emergency/Urgent Care': 'alert-circle-outline',
  Dental: 'happy-outline',
  'Mental Health': 'happy-outline',
  ENT: 'ear-outline',
  Ophthalmology: 'eye-outline',
};
