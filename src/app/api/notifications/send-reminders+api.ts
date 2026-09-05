import { REMINDER_LEAD_TIMES } from '@/lib/appointments';
import { getEmessageConfig, sendSms } from '@/lib/emessage';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Sends appointment reminders (SMS + push, matching the channels
 * confirm+api.ts and checkin/advance+api.ts already use) for every
 * confirmed appointment that has crossed one of REMINDER_LEAD_TIMES and
 * hasn't been reminded for that lead time yet.
 *
 * This route has no scheduler of its own — nothing in this repo runs a
 * persistent background worker (the only precedent, generate-health-id, is
 * a one-shot Supabase Edge Function). It's meant to be invoked periodically
 * (e.g. every 10-15 minutes) by an external trigger — a scheduled Supabase
 * Edge Function, Vercel Cron, or similar — authenticated with
 * REMINDER_CRON_SECRET the same way QUEUE_ADVANCE_SECRET gates
 * checkin/advance+api.ts.
 */

type ReminderRow = {
  id: string;
  citizen_hash: string;
  mobile_number: string | null;
  citizen_full_name: string | null;
  facility_name: string | null;
  scheduled_at: string;
  reference_number: string;
};

function formatReminderMessage(row: ReminderRow, label: string): string {
  const scheduledAt = new Date(row.scheduled_at);
  const dateStr = scheduledAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const greeting = row.citizen_full_name ? `Hi ${row.citizen_full_name},` : 'Hi,';
  const facility = row.facility_name ?? 'your facility';
  return `${greeting} reminder: your AGAPAY appointment at ${facility} on ${dateStr} at ${timeStr} is ${label}. Ref: ${row.reference_number}.`;
}

async function sendPushReminder(citizenHash: string, message: string) {
  if (!supabaseAdmin) return;

  const { data: tokens } = await supabaseAdmin
    .from('device_tokens')
    .select('push_token')
    .eq('citizen_hash', citizenHash);

  if (!tokens?.length) return;

  const { data: prefs } = await supabaseAdmin
    .from('queue_notification_preferences')
    .select('push_enabled')
    .eq('citizen_hash', citizenHash)
    .single();

  if (prefs?.push_enabled === false) return;

  const messages = tokens.map((t) => ({
    to: t.push_token,
    title: 'Appointment Reminder',
    body: message,
    sound: 'default',
  }));

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch {
    // Push failure is non-fatal, matching checkin/advance+api.ts.
  }
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  const cronSecret = process.env.REMINDER_CRON_SECRET;
  if (!cronSecret) {
    return Response.json({ error: 'Feature not configured' }, { status: 403 });
  }

  if (request.headers.get('x-reminder-secret') !== cronSecret) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const emessageConfig = getEmessageConfig();
  if (!emessageConfig) {
    console.warn('[send-reminders] eMessage not configured — SMS reminders will be skipped, push will still send');
  }

  const now = new Date();
  const sentCounts: Record<string, number> = {};

  for (const leadTime of REMINDER_LEAD_TIMES) {
    const windowEnd = new Date(now.getTime() + leadTime.hours * 60 * 60 * 1000);

    const { data: due, error } = await supabaseAdmin
      .from('appointments')
      .select('id, citizen_hash, mobile_number, citizen_full_name, facility_name, scheduled_at, reference_number')
      .eq('status', 'confirmed')
      .is(leadTime.sentAtColumn, null)
      .gt('scheduled_at', now.toISOString())
      .lte('scheduled_at', windowEnd.toISOString());

    if (error) {
      console.error(`[send-reminders] query failed for ${leadTime.sentAtColumn}:`, error.message);
      continue;
    }

    let sent = 0;

    for (const row of (due ?? []) as ReminderRow[]) {
      // Claim this row (and lead time) before sending anything — an update
      // scoped to "still unsent" that returns a row means this invocation
      // won the claim, so a second concurrent cron run can't double-send.
      const { data: claimed } = await supabaseAdmin
        .from('appointments')
        .update({ [leadTime.sentAtColumn]: now.toISOString() })
        .eq('id', row.id)
        .is(leadTime.sentAtColumn, null)
        .select('id')
        .single();

      if (!claimed) continue;

      const message = formatReminderMessage(row, leadTime.label);

      if (row.mobile_number && emessageConfig) {
        const smsResult = await sendSms(emessageConfig, row.mobile_number, message);
        if (!smsResult.ok) {
          console.warn(`[send-reminders] SMS failed for appointment ${row.id}:`, smsResult.kind);
        }
      }

      await sendPushReminder(row.citizen_hash, message);
      sent += 1;
    }

    sentCounts[leadTime.sentAtColumn] = sent;
  }

  return Response.json({ reminders_sent: sentCounts });
}
