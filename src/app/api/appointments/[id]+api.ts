import { supabase } from '@/lib/supabase';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id) {
    return Response.json({ error: 'Appointment id is required' }, { status: 400 });
  }

  const { data, error: updateError } = await supabase
    .from('appointments')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'confirmed')
    .select()
    .single();

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: 'Appointment not found or already cancelled' }, { status: 404 });
  }

  return Response.json({ appointment: data });
}
