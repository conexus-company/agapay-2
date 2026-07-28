import type { ApiResult } from '@/lib/api-result';
import type { Facility, FacilityType, Specialty } from '@/lib/health-navigation-types';
import { evaluateOpeningHours, expandOpeningHoursToWeek } from '@/lib/opening-hours';

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'agapay-app/1.0';
const SEARCH_RADIUS_METERS = 8000;
// Cap for the Stage-2 triage recommendation list — kept small and specialty-scoped.
const RESULT_CAP = 5;
// Cap for the general "Find Facilities" browse/search screen, which has no
// specialty filter and benefits from a larger pool to search/filter over.
const NEARBY_RESULT_CAP = 20;

// General healthcare amenities for the browse-all-nearby-facilities flow
// (Find Facilities screen), as opposed to SPECIALTY_TAGS below which scopes
// results to a single Stage-1 triage specialty.
const NEARBY_TAGS: [string, string][] = [
  ['amenity', 'hospital'],
  ['amenity', 'clinic'],
  ['amenity', 'doctors'],
];

// Stage 2 only: maps a Stage-1 specialty to real-world OSM tags. Hospitals
// are included everywhere since Philippine hospitals generally run general
// departments regardless of the specific specialty being searched for.
const SPECIALTY_TAGS: Record<Specialty, [string, string][]> = {
  'General Practice': [
    ['amenity', 'clinic'],
    ['amenity', 'doctors'],
    ['amenity', 'hospital'],
  ],
  Pediatrics: [
    ['amenity', 'hospital'],
    ['amenity', 'clinic'],
    ['healthcare', 'pediatrics'],
  ],
  'OB-GYN': [
    ['amenity', 'hospital'],
    ['healthcare', 'gynaecology'],
    ['healthcare', 'midwife'],
  ],
  Dermatology: [
    ['amenity', 'hospital'],
    ['healthcare', 'dermatology'],
  ],
  Orthopedics: [
    ['amenity', 'hospital'],
    ['healthcare', 'orthopaedics'],
  ],
  Cardiology: [
    ['amenity', 'hospital'],
    ['healthcare', 'cardiology'],
  ],
  'Emergency/Urgent Care': [['amenity', 'hospital']],
  Dental: [['amenity', 'dentist']],
  'Mental Health': [
    ['healthcare', 'psychotherapist'],
    ['healthcare', 'psychiatry'],
    ['amenity', 'clinic'],
  ],
  ENT: [
    ['amenity', 'hospital'],
    ['healthcare', 'otolaryngologist'],
  ],
  Ophthalmology: [
    ['healthcare', 'ophthalmologist'],
    ['amenity', 'hospital'],
    ['shop', 'optician'],
  ],
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildOverpassQuery(
  tags: [string, string][],
  lat: number,
  lng: number,
  radiusMeters: number = SEARCH_RADIUS_METERS,
): string {
  const clauses = tags
    .map(
      ([key, value]) =>
        `  node["${key}"="${value}"](around:${radiusMeters},${lat},${lng});\n` +
        `  way["${key}"="${value}"](around:${radiusMeters},${lat},${lng});`,
    )
    .join('\n');

  return `[out:json][timeout:25];\n(\n${clauses}\n);\nout center tags 60;`;
}

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function buildAddress(tags: Record<string, string> | undefined): string | undefined {
  if (!tags) return undefined;
  const streetLine = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const locality = tags['addr:city'] ?? tags['addr:suburb'] ?? tags['addr:district'];
  const combined = [streetLine || undefined, locality].filter(Boolean).join(', ');
  return combined.length > 0 ? combined : undefined;
}

// OSM tagging for public-vs-private ownership is sparse and inconsistent in
// the Philippines — only classify when the tag is actually present rather
// than guessing, so we never show an incorrect Government/Private badge.
function inferFacilityType(tags: Record<string, string> | undefined): FacilityType | undefined {
  const operatorType = tags?.['operator:type'];
  if (!operatorType) return undefined;
  const normalized = operatorType.toLowerCase();
  if (normalized.includes('government') || normalized.includes('public')) return 'Government';
  if (normalized.includes('private') || normalized.includes('ngo')) return 'Private';
  return undefined;
}

function inferIcon(amenity: string | undefined): NonNullable<Facility['icon']> {
  if (amenity === 'hospital') return 'business-outline';
  if (amenity === 'doctors') return 'person-outline';
  return 'medical-outline';
}

function inferServices(tags: Record<string, string> | undefined): string[] | undefined {
  const speciality = tags?.['healthcare:speciality'];
  if (!speciality) return undefined;
  const services = speciality
    .split(';')
    .map((token) => token.trim().replace(/_/g, ' '))
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1));
  return services.length > 0 ? services : undefined;
}

function mapElement(raw: OverpassElement, originLat: number, originLng: number): Facility | null {
  const name = raw.tags?.name;
  if (!name) return null;

  const facilityLat = raw.lat ?? raw.center?.lat;
  const facilityLng = raw.lon ?? raw.center?.lon;
  if (facilityLat === undefined || facilityLng === undefined) return null;

  const openingHours = raw.tags?.opening_hours;
  const openStatus = openingHours ? evaluateOpeningHours(openingHours) : 'unknown';

  return {
    id: `${raw.type}/${raw.id}`,
    name,
    distanceKm: haversineKm(originLat, originLng, facilityLat, facilityLng),
    openStatus,
    lat: facilityLat,
    lng: facilityLng,
    icon: inferIcon(raw.tags?.amenity),
    address: buildAddress(raw.tags),
    type: inferFacilityType(raw.tags),
    services: inferServices(raw.tags),
    hoursToday: openingHours ? (openStatus === 'open' ? 'Open now' : openStatus === 'closed' ? 'Closed now' : undefined) : undefined,
    hours: openingHours ? (expandOpeningHoursToWeek(openingHours) ?? undefined) : undefined,
  };
}

async function runOverpassQuery(
  query: string,
  originLat: number,
  originLng: number,
  resultCap: number,
): Promise<ApiResult<Facility[]>> {
  let response: Response;
  try {
    response = await fetch(OVERPASS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
      body: `data=${encodeURIComponent(query)}`,
    });
  } catch {
    return { ok: false, kind: 'network_error' };
  }

  if (!response.ok) {
    return { ok: false, kind: 'upstream_error', status: response.status, body: null };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { ok: false, kind: 'invalid_response', message: 'Overpass response was not valid JSON' };
  }

  const elements =
    json && typeof json === 'object' && 'elements' in json
      ? (json as { elements?: unknown }).elements
      : undefined;

  if (!Array.isArray(elements)) {
    return { ok: false, kind: 'invalid_response', message: 'Overpass response did not include elements' };
  }

  const seen = new Set<string>();
  const facilities: Facility[] = [];

  for (const raw of elements as OverpassElement[]) {
    const facility = mapElement(raw, originLat, originLng);
    if (!facility) continue;
    if (seen.has(facility.id)) continue;
    seen.add(facility.id);
    facilities.push(facility);
  }

  facilities.sort((a, b) => a.distanceKm - b.distanceKm);

  return { ok: true, data: facilities.slice(0, resultCap) };
}

export async function findFacilities(
  specialty: Specialty,
  lat: number,
  lng: number,
): Promise<ApiResult<Facility[]>> {
  const tags = SPECIALTY_TAGS[specialty];
  const query = buildOverpassQuery(tags, lat, lng);
  return runOverpassQuery(query, lat, lng, RESULT_CAP);
}

/**
 * Browses all nearby hospitals/clinics/doctors' offices without a specialty
 * filter — powers the Find Facilities list screen. Distinct from
 * `findFacilities` above, which scopes results to a single triage specialty
 * for the AI health navigation flow.
 */
export async function findNearbyFacilities(
  lat: number,
  lng: number,
  radiusMeters: number = SEARCH_RADIUS_METERS,
): Promise<ApiResult<Facility[]>> {
  const query = buildOverpassQuery(NEARBY_TAGS, lat, lng, radiusMeters);
  return runOverpassQuery(query, lat, lng, NEARBY_RESULT_CAP);
}
