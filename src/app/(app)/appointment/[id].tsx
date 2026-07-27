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
import { useAppointments, type Appointment } from '@/hooks/use-appointments';
import { useTheme } from '@/hooks/use-theme';

const STATUS_STYLES: Record<Appointment['status'], { bg: string; text: string; label: string }> = {
  confirmed: { bg: Brand.successBg, text: Brand.successText, label: 'Confirmed' },
  completed: { bg: Brand.infoBg, text: Brand.infoText, label: 'Completed' },
  cancelled: { bg: Brand.mutedBg, text: Brand.mutedText, label: 'Cancelled' },
  no_show: { bg: Brand.dangerBg, text: Brand.dangerText, label: 'No Show' },
};

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { items, loading, error, refresh, cancel } = useAppointments();
  const [cancelling, setCancelling] = useState(false);
  const [copied, setCopied] = useState(false);

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
  secondaryBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: Brand.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 15, fontWeight: '600', color: Brand.primary },
});
