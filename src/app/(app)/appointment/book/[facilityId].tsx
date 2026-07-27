import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset, Brand, Spacing } from '@/constants/theme';
import { useAppointments } from '@/hooks/use-appointments';
import { useTheme } from '@/hooks/use-theme';

const SERVICE_TYPES = [
  'General Consultation',
  'Vaccination',
  'Lab Test',
  'Dental',
];

const TIME_SLOTS = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

function generateDates(): { label: string; value: string; dayName: string; dayNum: string }[] {
  const dates: { label: string; value: string; dayName: string; dayNum: string }[] = [];
  const now = new Date();

  for (let i = 1; i <= 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);

    const dayName = d.toLocaleDateString('en-PH', { weekday: 'short' });
    const dayNum = String(d.getDate());
    const label = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    const value = d.toISOString().split('T')[0];

    dates.push({ label, value, dayName, dayNum });
  }

  return dates;
}

const DATES = generateDates();

export default function BookAppointmentScreen() {
  const { facilityId } = useLocalSearchParams<{ facilityId: string }>();
  const theme = useTheme();
  const { book } = useAppointments();

  const [serviceType, setServiceType] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = serviceType && selectedDate && selectedTime && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !facilityId) return;

    setSubmitting(true);
    setError(null);

    const scheduledAt = `${selectedDate}T${selectedTime}:00.000Z`;

    const result = await book({
      facilityId,
      serviceType,
      scheduledAt,
    });

    setSubmitting(false);

    if (result) {
      router.replace(`/appointment/${result.id}`);
    } else {
      setError('Failed to book appointment. Please try again.');
    }
  }, [canSubmit, facilityId, selectedDate, selectedTime, serviceType, book]);

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
            <Text style={[styles.title, { color: theme.text }]}>Book Appointment</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Facility: {facilityId}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Service Type</Text>
            <View style={styles.chipGroup}>
              {SERVICE_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setServiceType(type)}
                  style={({ pressed }) => [
                    styles.chip,
                    serviceType === type && styles.chipSelected,
                    pressed && { opacity: 0.7 },
                  ]}>
                  <Text style={[styles.chipText, serviceType === type && styles.chipTextSelected]}>
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Select Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
              {DATES.map((date) => (
                <Pressable
                  key={date.value}
                  onPress={() => setSelectedDate(date.value)}
                  style={({ pressed }) => [
                    styles.dateChip,
                    selectedDate === date.value && styles.dateChipSelected,
                    pressed && { opacity: 0.7 },
                  ]}>
                  <Text
                    style={[
                      styles.dateDayName,
                      selectedDate === date.value && styles.dateChipTextSelected,
                    ]}>
                    {date.dayName}
                  </Text>
                  <Text
                    style={[
                      styles.dateDayNum,
                      selectedDate === date.value && styles.dateChipTextSelected,
                    ]}>
                    {date.dayNum}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Select Time</Text>
            <View style={styles.chipGroup}>
              {TIME_SLOTS.map((slot) => (
                <Pressable
                  key={slot}
                  onPress={() => setSelectedTime(slot)}
                  style={({ pressed }) => [
                    styles.timeChip,
                    selectedTime === slot && styles.timeChipSelected,
                    pressed && { opacity: 0.7 },
                  ]}>
                  <Text style={[styles.timeText, selectedTime === slot && styles.timeTextSelected]}>
                    {slot}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.submitPressed,
              !canSubmit && styles.submitDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Confirm appointment">
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Confirm Appointment</Text>
            )}
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
  subtitle: { fontSize: 14, color: Brand.textSecondary },
  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Brand.textPrimary },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  chipSelected: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  chipText: { fontSize: 14, fontWeight: '500', color: Brand.textPrimary },
  chipTextSelected: { color: '#FFFFFF' },
  dateScroll: { marginHorizontal: -Spacing.four, paddingHorizontal: Spacing.four },
  dateChip: {
    width: 64,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    marginRight: Spacing.two,
  },
  dateChipSelected: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  dateDayName: { fontSize: 12, fontWeight: '500', color: Brand.textSecondary },
  dateDayNum: { fontSize: 18, fontWeight: '700', color: Brand.textPrimary, marginTop: 2 },
  dateChipTextSelected: { color: '#FFFFFF' },
  timeChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  timeChipSelected: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  timeText: { fontSize: 14, fontWeight: '600', color: Brand.textPrimary },
  timeTextSelected: { color: '#FFFFFF' },
  errorBanner: {
    backgroundColor: Brand.dangerBg,
    borderRadius: 12,
    padding: 12,
  },
  errorText: { color: Brand.danger, fontSize: 14 },
  submitButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  submitPressed: { opacity: 0.85 },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});
