import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset, Brand, Spacing } from '@/constants/theme';
import { useAppointments, type Appointment } from '@/hooks/use-appointments';
import { useTheme } from '@/hooks/use-theme';

const STATUS_STYLES: Record<Appointment['status'], { bg: string; text: string; label: string }> = {
  confirmed: { bg: Brand.successBg, text: Brand.successText, label: 'Confirmed' },
  completed: { bg: Brand.infoBg, text: Brand.infoText, label: 'Completed' },
  cancelled: { bg: Brand.mutedBg, text: Brand.mutedText, label: 'Cancelled' },
  no_show: { bg: Brand.dangerBg, text: Brand.dangerText, label: 'No Show' },
};

function AppointmentCard({
  appointment,
  onPress,
  onCancel,
}: {
  appointment: Appointment;
  onPress: () => void;
  onCancel: () => void;
}) {
  const statusStyle = STATUS_STYLES[appointment.status];
  const date = new Date(appointment.scheduled_at);
  const dateStr = date.toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.badgeText, { color: statusStyle.text }]}>{statusStyle.label}</Text>
        </View>
        <Text style={styles.refNumber}>{appointment.reference_number}</Text>
      </View>

      <Text style={styles.cardService}>{appointment.service_type}</Text>
      <Text style={styles.cardFacility}>{appointment.facility_id}</Text>

      <View style={styles.cardDateTime}>
        <Text style={styles.cardDate}>{dateStr}</Text>
        <Text style={styles.cardTime}>{timeStr}</Text>
      </View>

      <View style={styles.cardActions}>
        <Pressable onPress={onPress} style={({ pressed }) => [styles.cardActionBtn, pressed && { opacity: 0.7 }]}>
          <Text style={styles.cardActionText}>View Details</Text>
        </Pressable>
        {appointment.status === 'confirmed' && (
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [styles.cardCancelBtn, pressed && { opacity: 0.7 }]}>
            <Text style={styles.cardCancelText}>Cancel</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function AppointmentListScreen() {
  const theme = useTheme();
  const { items, loading, error, refresh, cancel } = useAppointments();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const handleCancel = useCallback(
    async (id: string) => {
      await cancel(id);
    },
    [cancel],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>My Appointments</Text>
          </View>

          {loading && items.length === 0 && (
            <View style={styles.loadingSection}>
              <ActivityIndicator size="large" color={Brand.primary} />
            </View>
          )}

          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={refresh} style={styles.retryButton}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          )}

          {!loading && !error && items.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No appointments yet</Text>
              <Text style={styles.emptySubtitle}>
                Find a facility and book your first appointment.
              </Text>
              <Pressable
                onPress={() => router.push('/explore')}
                style={({ pressed }) => [styles.emptyCta, pressed && { opacity: 0.85 }]}>
                <Text style={styles.emptyCtaText}>Find a Facility</Text>
              </Pressable>
            </View>
          )}

          {items.map((appt) => (
            <AppointmentCard
              key={appt.id}
              appointment={appt}
              onPress={() => router.push(`/appointment/${appt.id}`)}
              onCancel={() => handleCancel(appt.id)}
            />
          ))}
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
  header: { paddingTop: Spacing.four },
  title: { fontSize: 28, fontWeight: '700', lineHeight: 34, color: Brand.textPrimary },
  loadingSection: { alignItems: 'center', paddingVertical: Spacing.six },
  errorBanner: {
    backgroundColor: Brand.dangerBg,
    borderRadius: 12,
    padding: 12,
    gap: Spacing.two,
  },
  errorText: { color: Brand.danger, fontSize: 14 },
  retryButton: { alignSelf: 'flex-start' },
  retryText: { color: Brand.danger, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Brand.textPrimary },
  emptySubtitle: { fontSize: 15, color: Brand.textSecondary, textAlign: 'center' },
  emptyCta: {
    marginTop: Spacing.two,
    backgroundColor: Brand.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyCtaText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  refNumber: { fontSize: 12, fontWeight: '600', color: Brand.textSecondary, fontFamily: 'monospace' },
  cardService: { fontSize: 17, fontWeight: '600', color: Brand.textPrimary },
  cardFacility: { fontSize: 14, color: Brand.textSecondary },
  cardDateTime: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  cardDate: { fontSize: 14, fontWeight: '500', color: Brand.textPrimary },
  cardTime: { fontSize: 14, color: Brand.textSecondary },
  cardActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  cardActionBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: Brand.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActionText: { fontSize: 13, fontWeight: '600', color: Brand.primary },
  cardCancelBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: Brand.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCancelText: { fontSize: 13, fontWeight: '600', color: Brand.danger },
});
