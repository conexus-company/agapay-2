import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { BottomTabInset, Brand, Spacing } from '@/constants/theme';
import { QueueToast } from '@/components/queue-toast';
import { useAppointments, type Appointment } from '@/hooks/use-appointments';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useQueueStatus, type QueueStatus } from '@/hooks/use-queue-status';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth-context';
import { getNotificationsAuthToken } from '@/lib/notifications';

const STATUS_STYLES: Record<Appointment['status'], { bg: string; text: string; label: string }> = {
  confirmed: { bg: Brand.successBg, text: Brand.successText, label: 'Confirmed' },
  completed: { bg: Brand.infoBg, text: Brand.infoText, label: 'Completed' },
  cancelled: { bg: Brand.mutedBg, text: Brand.mutedText, label: 'Cancelled' },
  no_show: { bg: Brand.dangerBg, text: Brand.dangerText, label: 'No Show' },
};

const QUEUE_STATUS_STYLES: Record<QueueStatus, { bg: string; text: string; label: string }> = {
  waiting: { bg: Brand.mutedBg, text: Brand.mutedText, label: 'Waiting' },
  called: { bg: Brand.infoBg, text: Brand.infoText, label: 'Called' },
  completed: { bg: Brand.successBg, text: Brand.successText, label: 'Completed' },
  no_show: { bg: Brand.dangerBg, text: Brand.dangerText, label: 'No Show' },
};

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { items, loading, error, refresh, cancel } = useAppointments();
  const [cancelling, setCancelling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  const { session } = useAuth();
  usePushNotifications(getNotificationsAuthToken(session?.profile));

  const { status: queueStatus, queueNumber } = useQueueStatus({
    ticketId: activeTicketId,
    onStatusChange: useCallback((newStatus: QueueStatus) => {
      if (newStatus === 'called' || newStatus === 'completed') refresh();
    }, [refresh]),
  });

  useEffect(() => {
    refresh();
  }, [refresh]);

  const appointment = items.find((a) => a.id === id);

  const handleCopyRef = useCallback(async () => {
    if (!appointment) return;
    await Clipboard.setStringAsync(appointment.reference_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [appointment]);

  const handleCancel = useCallback(async () => {
    if (!id) return;
    setCancelling(true);
    await cancel(id);
    setCancelling(false);
  }, [id, cancel]);

  const handleCheckIn = useCallback(async () => {
    if (!appointment) return;
    setCheckingIn(true);
    setCheckinError(null);

    try {
      const res = await fetch('/api/checkin/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facility_id: appointment.facility_id,
          appointment_id: appointment.id,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setCheckinError(body.error ?? 'Check-in failed');
        setCheckingIn(false);
        return;
      }

      const data = await res.json();
      setActiveTicketId(data.ticket_id);
    } catch {
      setCheckinError('Network error');
    }

    setCheckingIn(false);
  }, [appointment]);

  if (loading && !appointment) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={Brand.primary} style={{ marginTop: 100 }} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={refresh}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!appointment) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centered}>
            <Text style={styles.errorText}>Appointment not found.</Text>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.retryText}>Go back</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const statusStyle = STATUS_STYLES[appointment.status];
  const date = new Date(appointment.scheduled_at);
  const dateStr = date.toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <QueueToast status={queueStatus} queueNumber={queueNumber} ticketId={activeTicketId} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backText}>Back</Text>
            </Pressable>
            <Text style={[styles.title, { color: theme.text }]}>Appointment Details</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.refSection}>
              <Text style={styles.refLabel}>Reference Number</Text>
              <View style={styles.refRow}>
                <Text style={styles.refNumber}>{appointment.reference_number}</Text>
                <Pressable onPress={handleCopyRef} style={styles.copyBtn}>
                  <Text style={styles.copyText}>{copied ? 'Copied!' : 'Copy'}</Text>
                </Pressable>
              </View>
            </View>

            <View style={[styles.statusRow, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.text }]}>
                {statusStyle.label}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Service</Text>
              <Text style={styles.detailValue}>{appointment.service_type}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Facility</Text>
              <Text style={styles.detailValue}>{appointment.facility_id}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{dateStr}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Time</Text>
              <Text style={styles.detailValue}>{timeStr}</Text>
            </View>
          </View>

          {activeTicketId && queueStatus && queueNumber && (
            <View style={styles.card}>
              <View style={styles.refSection}>
                <Text style={styles.refLabel}>Queue Status</Text>
                <View style={styles.refRow}>
                  <Text style={styles.refNumber}>{queueNumber}</Text>
                </View>
              </View>
              <View style={[styles.statusRow, { backgroundColor: QUEUE_STATUS_STYLES[queueStatus].bg }]}>
                <Text style={[styles.statusText, { color: QUEUE_STATUS_STYLES[queueStatus].text }]}>
                  {QUEUE_STATUS_STYLES[queueStatus].label}
                </Text>
              </View>
            </View>
          )}

          {appointment.status === 'confirmed' && !activeTicketId && (
            <Pressable
              onPress={handleCheckIn}
              disabled={checkingIn}
              style={({ pressed }) => [
                styles.checkinButton,
                pressed && { opacity: 0.85 },
                checkingIn && { opacity: 0.5 },
              ]}>
              {checkingIn ? (
                <ActivityIndicator color={Brand.surface} />
              ) : (
                <Text style={styles.checkinText}>Check In</Text>
              )}
            </Pressable>
          )}

          {checkinError && (
            <Text style={styles.checkinError}>{checkinError}</Text>
          )}

          {appointment.status === 'confirmed' && (
            <Pressable
              onPress={handleCancel}
              disabled={cancelling}
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && { opacity: 0.85 },
                cancelling && { opacity: 0.5 },
              ]}>
              {cancelling ? (
                <ActivityIndicator color="#DC2626" />
              ) : (
                <Text style={styles.cancelText}>Cancel Appointment</Text>
              )}
            </Pressable>
          )}

          <Pressable
            onPress={() => router.push('/appointment')}
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}>
            <Text style={styles.secondaryText}>Back to Appointments</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  header: { paddingTop: Spacing.four, gap: Spacing.one },
  backBtn: { marginBottom: Spacing.one },
  backText: { fontSize: 15, fontWeight: '500', color: Brand.primary },
  title: { fontSize: 28, fontWeight: '700', lineHeight: 34, color: Brand.textPrimary },
  centered: { alignItems: 'center', paddingVertical: Spacing.six, gap: Spacing.two },
  errorText: { color: Brand.danger, fontSize: 15 },
  retryText: { color: Brand.primary, fontSize: 15, fontWeight: '600' },
  card: {
    backgroundColor: Brand.surface,
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  refSection: { gap: Spacing.one },
  refLabel: { fontSize: 12, fontWeight: '600', color: Brand.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  refNumber: { fontSize: 24, fontWeight: '800', color: Brand.textPrimary, fontFamily: 'monospace', letterSpacing: 1 },
  copyBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: Brand.background },
  copyText: { fontSize: 13, fontWeight: '600', color: Brand.primary },
  statusRow: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: Spacing.one,
  },
  statusText: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Brand.background,
  },
  detailLabel: { fontSize: 14, color: Brand.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '600', color: Brand.textPrimary },
  cancelButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: Brand.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: Brand.danger },
  checkinButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkinText: { fontSize: 15, fontWeight: '600', color: Brand.surface },
  checkinError: { fontSize: 14, color: Brand.danger, textAlign: 'center' },
  secondaryBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: Brand.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 15, fontWeight: '600', color: Brand.primary },
});
