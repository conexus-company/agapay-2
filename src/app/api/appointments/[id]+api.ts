import { supabaseAdmin } from '@/lib/supabase-admin';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!supabaseAdmin) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { id } = await params;

  if (!id) {
    return Response.json({ error: 'Appointment id is required' }, { status: 400 });
  }

  const { data, error: updateError } = await supabaseAdmin
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
