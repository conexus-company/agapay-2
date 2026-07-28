import type { Facility } from '@/hooks/use-facilities';

type NearbyResponse = {
  center: { lat: number; lng: number };
  facilities: Facility[];
};

const DEFAULT_CENTER = { lat: 14.5995, lng: 120.9842 };

const STUB_FACILITIES: Facility[] = [
  {
    id: 'demo-1',
    name: 'East Avenue Medical Center',
    type: 'Hospital',
    address: 'East Avenue, Quezon City',
    lat: 14.6414,
    lng: 121.0439,
    distance_km: 4.8,
  },
  {
    id: 'demo-2',
    name: 'Philippine General Hospital',
    type: 'Hospital',
    address: 'Taft Avenue, Manila',
    lat: 14.5794,
    lng: 120.9852,
    distance_km: 1.2,
  },
  {
    id: 'demo-3',
    name: 'Quezon City Health Department',
    type: 'Clinic',
    address: 'Elliptical Road, Quezon City',
    lat: 14.6514,
    lng: 121.0493,
    distance_km: 5.6,
  },
  {
    id: 'demo-4',
    name: "St. Luke's Medical Center",
    type: 'Hospital',
    address: 'E. Rodriguez Sr. Ave, Quezon City',
    lat: 14.6194,
    lng: 121.0297,
    distance_km: 3.1,
  },
  {
    id: 'demo-5',
    name: 'Manila Doctors Hospital',
    type: 'Hospital',
    address: 'United Nations Avenue, Manila',
    lat: 14.5806,
    lng: 120.9842,
    distance_km: 1.4,
  },
];

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const latParam = url.searchParams.get('lat');
  const lngParam = url.searchParams.get('lng');
  const radiusParam = url.searchParams.get('radius_km');

  const lat = latParam ? parseFloat(latParam) : NaN;
  const lng = lngParam ? parseFloat(lngParam) : NaN;
  const radiusKm = radiusParam ? parseFloat(radiusParam) : 5;

  const hasCoords = !isNaN(lat) && !isNaN(lng);
  const center = hasCoords ? { lat, lng } : DEFAULT_CENTER;

  let facilities: Facility[];

  if (process.env.EGOV_FACILITIES_BASE_URL) {
    facilities = [];
  } else {
    facilities = STUB_FACILITIES.map((f) => ({
      ...f,
      distance_km: parseFloat(haversineDistance(center.lat, center.lng, f.lat, f.lng).toFixed(1)),
    })).filter((f) => f.distance_km <= radiusKm);

    facilities.sort((a, b) => a.distance_km - b.distance_km);
  }

  const response: NearbyResponse = { center, facilities };
  return Response.json(response);
}
