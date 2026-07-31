import type { ApiResult } from '@/lib/api-result';
import type { Doctor, Facility, FacilityHours } from '@/lib/health-navigation-types';
import { evaluateStructuredHours } from '@/lib/opening-hours';
import { supabase } from '@/lib/supabase';

type FacilityRow = {
  id: string;
  name: string;
  facility_type: string;
  ownership: 'government' | 'private' | null;
  address: string | null;
  city: string | null;
  province: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  email: string | null;
  website: string | null;
  icon: string | null;
  services: string[] | null;
  opening_hours: { day: string; open: string | null; close: string | null }[] | null;
  rating: number | null;
  is_verified: boolean;
};

type ProviderRow = {
  id: string;
  full_name: string;
  specialty: string;
};

const FACILITY_COLUMNS =
  'id, name, facility_type, ownership, address, city, province, lat, lng, phone, email, website, icon, services, opening_hours, rating, is_verified';
const PROVIDER_COLUMNS = 'id, full_name, specialty';

function upstreamError(message: string): ApiResult<never> {
  return { ok: false, kind: 'upstream_error', status: 0, body: message };
}

function mapFacilityRow(row: FacilityRow): Facility {
  const hours: FacilityHours[] = (row.opening_hours ?? []).map((entry) => ({
    day: entry.day,
    open: entry.open ?? '',
    close: entry.close ?? '',
  }));
  const openStatus = evaluateStructuredHours(hours);
  const hoursToday =
    openStatus === 'open' ? 'Open now' : openStatus === 'closed' ? 'Closed now' : undefined;

  return {
    id: row.id,
    name: row.name,
    distanceKm: 0,
    openStatus,
    lat: row.lat,
    lng: row.lng,
    icon: (row.icon ?? 'medical-outline') as Facility['icon'],
    address: [row.address, row.city, row.province].filter(Boolean).join(', ') || undefined,
    rating: row.rating ?? undefined,
    isVerified: row.is_verified,
    hoursToday,
    type: row.ownership === 'government' ? 'Government' : row.ownership === 'private' ? 'Private' : undefined,
    services: row.services ?? undefined,
    hours: hours.length > 0 ? hours : undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    website: row.website ?? undefined,
  };
}

function mapProviderRow(row: ProviderRow): Doctor {
  return { id: row.id, name: row.full_name, specialty: row.specialty };
}

export async function getFacilityById(facilityId: string): Promise<ApiResult<Facility>> {
  const { data, error } = await supabase
    .from('healthcare_facilities')
    .select(FACILITY_COLUMNS)
    .eq('id', facilityId)
    .maybeSingle<FacilityRow>();

  if (error) return upstreamError(error.message);
  if (!data) return { ok: false, kind: 'invalid_response', message: 'Facility not found' };

  const facility = mapFacilityRow(data);
  const providers = await getFacilityProviders(facilityId);
  if (providers.ok) facility.doctors = providers.data;

  return { ok: true, data: facility };
}

export async function getFacilityProviders(facilityId: string): Promise<ApiResult<Doctor[]>> {
  const { data, error } = await supabase
    .from('healthcare_providers')
    .select(PROVIDER_COLUMNS)
    .eq('facility_id', facilityId)
    .eq('is_active', true)
    .order('full_name')
    .returns<ProviderRow[]>();

  if (error) return upstreamError(error.message);
  return { ok: true, data: (data ?? []).map(mapProviderRow) };
}

export async function getDirectoryFacilities(): Promise<ApiResult<Facility[]>> {
  const { data, error } = await supabase
    .from('healthcare_facilities')
    .select(FACILITY_COLUMNS)
    .order('name')
    .returns<FacilityRow[]>();

  if (error) return upstreamError(error.message);
  return { ok: true, data: (data ?? []).map(mapFacilityRow) };
}
