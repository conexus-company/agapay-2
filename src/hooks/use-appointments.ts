import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type Appointment = {
  id: string;
  reference_number: string;
  facility_id: string;
  service_type: string;
  scheduled_at: string;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  created_at: string;
};

type UseAppointmentsState = {
  items: Appointment[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  book: (payload: {
    facilityId: string;
    serviceType: string;
    scheduledAt: string;
    consentId?: string;
  }) => Promise<Appointment | null>;
  cancel: (appointmentId: string) => Promise<void>;
};

export function useAppointments(): UseAppointmentsState {
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('appointments')
      .select('*')
      .neq('status', 'cancelled')
      .order('scheduled_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setItems(data ?? []);
    }

    setLoading(false);
  }, []);

  const book = useCallback(
    async (payload: {
      facilityId: string;
      serviceType: string;
      scheduledAt: string;
      consentId?: string;
    }): Promise<Appointment | null> => {
      const ref = `AGP-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const { data, error: insertError } = await supabase
        .from('appointments')
        .insert({
          reference_number: ref,
          citizen_hash: 'stub-citizen-hash',
          facility_id: payload.facilityId,
          service_type: payload.serviceType,
          scheduled_at: payload.scheduledAt,
          status: 'confirmed',
          consented_fields: payload.consentId ? { consent_id: payload.consentId } : {},
        })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message);
        return null;
      }

      await refresh();
      return data as Appointment;
    },
    [refresh],
  );

  const cancel = useCallback(
    async (appointmentId: string) => {
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', appointmentId)
        .eq('status', 'confirmed');

      if (updateError) {
        setError(updateError.message);
      } else {
        await refresh();
      }
    },
    [refresh],
  );

  return { items, loading, error, refresh, book, cancel };
}
