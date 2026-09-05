import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthColors } from '@/constants/auth-theme';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import {
  applyBookedSlots,
  bookAppointment,
  confirmBooking,
  fetchBookedSlots,
  formatBookingDate,
  getDefaultSelectedDate,
  getMockAvailableSchedule,
  type AvailableSchedule,
  type BookingDraft,
} from '@/lib/appointments';
import { resolveSsoSubjectId } from '@/lib/health-profile';
import type { Doctor, FacilityHours } from '@/lib/health-navigation-types';

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_LOADING_DELAY_MS = 400;

function parseDoctorParam(value: string | undefined): Doctor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && typeof parsed.id === 'string' && typeof parsed.name === 'string') {
      return parsed as Doctor;
    }
    return null;
  } catch {
    return null;
  }
}

function parseFacilityHoursParam(value: string | undefined): FacilityHours[] | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) return undefined;
    return parsed as FacilityHours[];
  } catch {
    return undefined;
  }
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function ErrorState({ message }: { message: string }) {
  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.errorSafeArea}>
        <View style={styles.errorBlock}>
          <View style={styles.errorIconCircle}>
            <Ionicons name="alert-circle-outline" size={32} color={AuthColors.danger} />
          </View>
          <Text style={styles.errorTitle}>Can&apos;t book this appointment</Text>
          <Text style={styles.errorSubtitle}>{message}</Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [styles.errorButton, pressed && styles.pressed]}>
            <Text style={styles.errorButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function CalendarStrip({
  schedule,
  selectedDate,
  today,
  onSelectDate,
}: {
  schedule: AvailableSchedule;
  selectedDate: string | null;
  today: string;
  onSelectDate: (date: string) => void;
}) {
  const monthLabel = useMemo(() => {
    if (schedule.dates.length === 0) return '';
    const [year, month] = schedule.dates[0].date.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [schedule.dates]);

  const cells = useMemo(() => {
    if (schedule.dates.length === 0) return [];
    const [year, month, day] = schedule.dates[0].date.split('-').map(Number);
    const leadingBlanks = (new Date(year, month - 1, day).getDay() + 6) % 7; // Monday-first offset
    return [...(Array(leadingBlanks).fill(null) as null[]), ...schedule.dates];
  }, [schedule.dates]);

  return (
    <View>
      <Text style={styles.monthLabel}>{monthLabel}</Text>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.calendarGrid}>
        {cells.map((entry, index) => {
          if (!entry) return <View key={`blank-${index}`} style={styles.dateCell} />;

          const dayNumber = Number(entry.date.slice(-2));
          const isToday = entry.date === today;
          const isSelected = entry.date === selectedDate;
          const isPast = entry.date < today;
          const blocked = !entry.isAvailable;
          // Past dates are truly inert (no reason needed — it's obvious).
          // Hours-blocked dates (closed day) stay pressable so tapping can
          // surface the specific reason instead of silently doing nothing.
          const nativeDisabled = blocked && isPast;

          return (
            <Pressable
              key={entry.date}
              disabled={nativeDisabled}
              onPress={() => onSelectDate(entry.date)}
              accessibilityRole="button"
              accessibilityLabel={`Select ${entry.date}`}
              accessibilityState={{ selected: isSelected, disabled: blocked }}
              style={styles.dateCell}>
              <View style={[styles.dateCircle, isSelected && styles.dateCircleSelected, isToday && !isSelected && styles.dateCircleToday]}>
                <Text style={[styles.dateText, blocked && styles.dateTextDisabled, isSelected && styles.dateTextSelected]}>
                  {dayNumber}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TimeSlotGrid({
  slots,
  selectedTime,
  onSelectTime,
}: {
  slots: AvailableSchedule['timeSlots'];
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
}) {
  if (slots.length === 0) {
    return (
      <View style={styles.emptySlots}>
        <Text style={styles.emptySlotsText}>No available slots for this date</Text>
      </View>
    );
  }

  return (
    <View style={styles.slotGrid}>
      {slots.map((slot) => {
        const isSelected = slot.time === selectedTime;
        return (
          <Pressable
            key={slot.time}
            onPress={() => onSelectTime(slot.time)}
            accessibilityRole="button"
            accessibilityLabel={`Select ${slot.time}`}
            accessibilityState={{ selected: isSelected, disabled: !slot.isAvailable }}
            style={[styles.slotButton, isSelected && styles.slotButtonSelected, !slot.isAvailable && styles.slotButtonDisabled]}>
            <Text style={[styles.slotText, isSelected && styles.slotTextSelected, !slot.isAvailable && styles.slotTextDisabled]}>
              {slot.time}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ScheduleSelectionScreen() {
  const { doctor: doctorParam, facilityId, facilityName, facilityHours: facilityHoursParam } = useLocalSearchParams<{
    doctor?: string;
    facilityId?: string;
    facilityName?: string;
    facilityHours?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const doctor = parseDoctorParam(doctorParam);
  const facilityHours = useMemo(() => parseFacilityHoursParam(facilityHoursParam), [facilityHoursParam]);

  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<AvailableSchedule | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [dateBlockedMessage, setDateBlockedMessage] = useState<string | null>(null);
  const [timeBlockedMessage, setTimeBlockedMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const today = useMemo(() => toIsoDate(new Date()), []);

  useEffect(() => {
    if (!doctor || !facilityId) return;
    const doctorId = doctor.id;
    const currentFacilityId = facilityId;
    let cancelled = false;

    // Simulated latency for the mock day/hours grid (see
    // src/lib/appointments.ts) — but which slots are already taken is real,
    // fetched from api/appointments/availability+api.ts and overlaid once
    // it resolves, so the initial paint isn't blocked on a network call.
    function loadSchedule() {
      setLoading(true);
      return setTimeout(() => {
        if (cancelled) return;
        const nextSchedule = getMockAvailableSchedule(doctorId, facilityHours);
        setSchedule(nextSchedule);
        setSelectedDate(getDefaultSelectedDate(nextSchedule));
        setLoading(false);

        fetchBookedSlots(currentFacilityId, doctorId).then((booked) => {
          if (cancelled || booked.size === 0) return;
          setSchedule((current) => (current ? applyBookedSlots(current, booked) : current));
        });
      }, MONTH_LOADING_DELAY_MS);
    }

    const timer = loadSchedule();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // doctor is re-parsed fresh from route params every render, so depending
    // on the object itself (rather than its stable id) would refetch forever;
    // facilityHours is memoized on its raw param string for the same reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctor?.id, facilityId, facilityHours]);

  if (!doctor || !facilityId || !facilityName) {
    return <ErrorState message="We couldn't find the doctor or facility for this booking. Please go back and try again." />;
  }

  const timeSlotsForDate = schedule?.timeSlots.filter((slot) => slot.date === selectedDate) ?? [];
  const canConfirm = Boolean(selectedDate && selectedTime) && !confirming;

  const handleSelectDate = (date: string) => {
    const entry = schedule?.dates.find((d) => d.date === date);
    if (entry && !entry.isAvailable) {
      setDateBlockedMessage(entry.reason ?? null);
      return;
    }
    setSelectedDate(date);
    setSelectedTime(null);
    setDateBlockedMessage(null);
    setTimeBlockedMessage(null);
    setConfirmError(null);
  };

  const handleSelectTime = (time: string) => {
    const entry = schedule?.timeSlots.find((slot) => slot.date === selectedDate && slot.time === time);
    if (entry && !entry.isAvailable) {
      setTimeBlockedMessage(entry.reason ?? null);
      return;
    }
    setSelectedTime(time);
    setTimeBlockedMessage(null);
    setConfirmError(null);
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime || !doctor) return;

    const draft: BookingDraft = {
      doctorId: doctor.id,
      doctorName: doctor.name,
      specialty: doctor.specialty,
      facilityId,
      facilityName,
      selectedDate,
      selectedTime,
      facilityHours,
    };

    setConfirming(true);
    setConfirmError(null);

    // The facility-hours gate lives in confirm+api.ts today, so it runs
    // first — book+api.ts only persists a slot that's already passed it.
    const smsResult = await confirmBooking(draft, session?.profile);

    if (!smsResult.ok) {
      const upstreamMessage =
        smsResult.kind === 'upstream_error' && smsResult.status === 422 && smsResult.body && typeof smsResult.body === 'object'
          ? (smsResult.body as Record<string, unknown>).error
          : null;
      setConfirming(false);
      setConfirmError(
        typeof upstreamMessage === 'string' ? upstreamMessage : "We couldn't confirm your appointment. Please try again."
      );
      scrollRef.current?.scrollToEnd({ animated: true });
      return;
    }

    const citizenToken = resolveSsoSubjectId(session?.profile);
    const bookingResult = await bookAppointment(draft, citizenToken, session?.profile);

    setConfirming(false);

    if (!bookingResult.ok) {
      const upstreamMessage =
        bookingResult.kind === 'upstream_error' && bookingResult.status < 500 && bookingResult.body && typeof bookingResult.body === 'object'
          ? (bookingResult.body as Record<string, unknown>).error
          : null;
      setConfirmError(
        typeof upstreamMessage === 'string' ? upstreamMessage : "We couldn't confirm your appointment. Please try again."
      );
      scrollRef.current?.scrollToEnd({ animated: true });
      return;
    }

    router.push({
      // The Appointment Confirmed screen is a separate, not-yet-built task
      // (see A-018 spec) — this path is the agreed hand-off target.
      pathname: '/appointments/confirmation',
      params: {
        doctorName: draft.doctorName,
        specialty: draft.specialty,
        facilityName: draft.facilityName,
        selectedDate: draft.selectedDate,
        selectedTime: draft.selectedTime,
        referenceNumber: bookingResult.data.reference_number,
      },
    } as unknown as Href);
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={24} color={AuthColors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Book Appointment</Text>
          <View style={styles.backButton} />
        </View>
      </SafeAreaView>

      <ScrollView ref={scrollRef} style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        {loading || !schedule ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color={AuthColors.primary} />
            <Text style={styles.loadingText}>Loading available schedule…</Text>
          </View>
        ) : (
          <>
            <CalendarStrip schedule={schedule} selectedDate={selectedDate} today={today} onSelectDate={handleSelectDate} />

            {dateBlockedMessage && (
              <View style={styles.hintBanner} accessibilityRole="alert">
                <Text style={styles.hintBannerText}>{dateBlockedMessage}</Text>
              </View>
            )}

            <Text style={styles.sectionLabel}>Available Times</Text>
            <TimeSlotGrid slots={timeSlotsForDate} selectedTime={selectedTime} onSelectTime={handleSelectTime} />

            {timeBlockedMessage && (
              <View style={styles.hintBanner} accessibilityRole="alert">
                <Text style={styles.hintBannerText}>{timeBlockedMessage}</Text>
              </View>
            )}

            <View style={styles.summaryCard}>
              <Text style={styles.summaryHeader}>APPOINTMENT SUMMARY</Text>
              <SummaryRow label="Doctor" value={doctor.name} />
              <SummaryRow label="Specialty" value={doctor.specialty} />
              <SummaryRow label="Date" value={selectedDate ? formatBookingDate(selectedDate) : '—'} />
              <SummaryRow label="Time" value={selectedTime ?? '—'} />
            </View>

            {confirmError && (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <Text style={styles.errorBannerText}>{confirmError}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
        <Pressable
          onPress={handleConfirm}
          disabled={!canConfirm}
          accessibilityRole="button"
          accessibilityLabel="Confirm appointment"
          accessibilityState={{ disabled: !canConfirm }}
          style={({ pressed }) => [styles.confirmButton, !canConfirm && styles.confirmButtonDisabled, pressed && canConfirm && styles.pressed]}>
          {confirming ? (
            <ActivityIndicator size="small" color={AuthColors.onPrimary} />
          ) : (
            <Text style={styles.confirmButtonText}>Confirm Appointment</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AuthColors.surface,
  },
  headerSafeArea: {
    backgroundColor: AuthColors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AuthColors.border,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: AuthColors.text,
  },
  pressed: {
    opacity: 0.7,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: Spacing.four,
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  loadingBlock: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
    gap: Spacing.three,
  },
  loadingText: {
    fontSize: 14,
    color: AuthColors.textSecondary,
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: AuthColors.text,
    marginBottom: Spacing.two,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: AuthColors.textSecondary,
    marginBottom: Spacing.one,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dateCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCircleSelected: {
    backgroundColor: AuthColors.primary,
  },
  dateCircleToday: {
    borderWidth: 2,
    borderColor: AuthColors.primary,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    color: AuthColors.text,
  },
  dateTextDisabled: {
    color: AuthColors.border,
    fontWeight: '400',
  },
  dateTextSelected: {
    color: AuthColors.onPrimary,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: AuthColors.text,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  slotButton: {
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AuthColors.border,
    backgroundColor: AuthColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
  },
  slotButtonSelected: {
    backgroundColor: AuthColors.primary,
    borderColor: AuthColors.primary,
  },
  slotButtonDisabled: {
    backgroundColor: AuthColors.background,
    borderColor: AuthColors.border,
  },
  slotText: {
    fontSize: 14,
    fontWeight: '600',
    color: AuthColors.text,
  },
  slotTextSelected: {
    color: AuthColors.onPrimary,
  },
  slotTextDisabled: {
    color: AuthColors.textSecondary,
  },
  emptySlots: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
  },
  emptySlotsText: {
    fontSize: 14,
    color: AuthColors.textSecondary,
  },
  summaryCard: {
    backgroundColor: AuthColors.background,
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  summaryHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: AuthColors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: Spacing.one,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  summaryLabel: {
    fontSize: 14,
    color: AuthColors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: AuthColors.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  errorBanner: {
    backgroundColor: AuthColors.dangerBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AuthColors.danger,
    padding: Spacing.three,
  },
  errorBannerText: {
    color: AuthColors.danger,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  hintBanner: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AuthColors.accent,
    padding: Spacing.three,
  },
  hintBannerText: {
    color: AuthColors.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomBar: {
    backgroundColor: AuthColors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AuthColors.border,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  confirmButton: {
    minHeight: 44,
    backgroundColor: AuthColors.primary,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
  },
  confirmButtonDisabled: {
    backgroundColor: AuthColors.border,
  },
  confirmButtonText: {
    color: AuthColors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  errorSafeArea: {
    flex: 1,
  },
  errorBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  errorIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: AuthColors.dangerBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AuthColors.text,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    color: AuthColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorButton: {
    minHeight: 44,
    backgroundColor: AuthColors.primary,
    borderRadius: 999,
    paddingHorizontal: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorButtonText: {
    color: AuthColors.onPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});
