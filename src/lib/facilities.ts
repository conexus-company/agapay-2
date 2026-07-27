import type { ApiResult } from '@/lib/api-result';
import type { Facility, Specialty } from '@/lib/health-navigation-types';
import { evaluateOpeningHours } from '@/lib/opening-hours';

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'agapay-app/1.0';
const SEARCH_RADIUS_METERS = 8000;
const RESULT_CAP = 5;

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

function buildOverpassQuery(tags: [string, string][], lat: number, lng: number): string {
  const clauses = tags
    .map(
      ([key, value]) =>
        `  node["${key}"="${value}"](around:${SEARCH_RADIUS_METERS},${lat},${lng});\n` +
        `  way["${key}"="${value}"](around:${SEARCH_RADIUS_METERS},${lat},${lng});`,
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

export async function findFacilities(
  specialty: Specialty,
  lat: number,
  lng: number,
): Promise<ApiResult<Facility[]>> {
  const tags = SPECIALTY_TAGS[specialty];
  const query = buildOverpassQuery(tags, lat, lng);

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
    const name = raw.tags?.name;
    if (!name) continue;

    const facilityLat = raw.lat ?? raw.center?.lat;
    const facilityLng = raw.lon ?? raw.center?.lon;
    if (facilityLat === undefined || facilityLng === undefined) continue;

    const id = `${raw.type}/${raw.id}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const openingHours = raw.tags?.opening_hours;
    const openStatus = openingHours ? evaluateOpeningHours(openingHours) : 'unknown';

    facilities.push({
      id,
      name,
      distanceKm: haversineKm(lat, lng, facilityLat, facilityLng),
      openStatus,
      lat: facilityLat,
      lng: facilityLng,
    });
  }

  facilities.sort((a, b) => a.distanceKm - b.distanceKm);

  return { ok: true, data: facilities.slice(0, RESULT_CAP) };
}
