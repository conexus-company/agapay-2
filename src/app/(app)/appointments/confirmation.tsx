import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { QrDisplay } from '@/components/health-profile/qr-display';
import { BottomTabInset, Brand, Spacing } from '@/constants/theme';
import { formatBookingDate, persistBooking } from '@/lib/appointments';

function generateReferenceNumber(): string {
  return `AGP-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

function ErrorState({ message }: { message: string }) {
  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <View style={styles.errorIconCircle}>
            <Ionicons name="alert-circle-outline" size={32} color={Brand.danger} />
          </View>
          <Text style={styles.errorTitle}>Can&apos;t show this confirmation</Text>
          <Text style={styles.errorSubtitle}>{message}</Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>Go back</Text>
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

export default function AppointmentConfirmationScreen() {
  const { doctorName, specialty, facilityName, facilityId, selectedDate, selectedTime } = useLocalSearchParams<{
    doctorName?: string;
    specialty?: string;
    facilityName?: string;
    facilityId?: string;
    selectedDate?: string;
    selectedTime?: string;
  }>();

  const [copied, setCopied] = useState(false);
  const fallbackReference = useMemo(() => generateReferenceNumber(), []);
  const [savedReference, setSavedReference] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const referenceNumber = savedReference ?? fallbackReference;

  const handleCopyRef = useCallback(async () => {
    await Clipboard.setStringAsync(referenceNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [referenceNumber]);

  useEffect(() => {
    if (!doctorName || !specialty || !facilityName || !facilityId || !selectedDate || !selectedTime) {
      return;
    }
    let cancelled = false;

    const persist = async () => {
      const result = await persistBooking({
        facilityId,
        serviceType: specialty,
        selectedDate,
        selectedTime,
      });
      if (cancelled) return;
      if (result.ok) {
        setSavedReference(result.data.referenceNumber);
      } else {
        setSaveFailed(true);
      }
    };

    persist();
    return () => {
      cancelled = true;
    };
    // Params are stable route values, so the effect fires once on mount.
  }, [doctorName, specialty, facilityName, facilityId, selectedDate, selectedTime]);

  if (!doctorName || !specialty || !facilityName || !facilityId || !selectedDate || !selectedTime) {
    return (
      <ErrorState message="We couldn't find the details for this appointment. Please go back and try again." />
    );
  }

  const qrPayload = JSON.stringify({
    type: 'appointment-pass',
    version: 1,
    reference: referenceNumber,
    facility: facilityName,
    facilityId: facilityId ?? null,
    doctor: doctorName,
    specialty,
    date: formatBookingDate(selectedDate),
    time: selectedTime,
  });

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
              <Ionicons name="chevron-back" size={24} color={Brand.textPrimary} />
            </Pressable>
            <Text style={styles.headerTitle}>Appointment Confirmed</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.successBlock}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark" size={36} color="#FFFFFF" />
            </View>
            <Text style={styles.successTitle}>You&apos;re all set!</Text>
            <Text style={styles.successSubtitle}>
              Your appointment is confirmed. Show the QR pass below at the facility front desk to
              check in.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.refLabel}>Reference Number</Text>
            <View style={styles.refRow}>
              <Text selectable style={styles.refNumber}>
                {referenceNumber}
              </Text>
              <Pressable
                onPress={handleCopyRef}
                accessibilityRole="button"
                accessibilityLabel="Copy reference number"
                style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]}>
                <Text style={styles.copyText}>{copied ? 'Copied!' : 'Copy'}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardHeader}>APPOINTMENT SUMMARY</Text>
            <SummaryRow label="Facility" value={facilityName} />
            <SummaryRow label="Doctor" value={doctorName} />
            <SummaryRow label="Specialty" value={specialty} />
            <SummaryRow label="Date" value={formatBookingDate(selectedDate)} />
            <SummaryRow label="Time" value={selectedTime} />
          </View>

          <View style={styles.passCard}>
            <Text style={styles.passLabel}>APPOINTMENT PASS</Text>
            {savedReference || saveFailed ? (
              <QrDisplay value={qrPayload} size={200} accessibilityLabel="Appointment QR pass" />
            ) : (
              <View style={styles.passPlaceholder}>
                <ActivityIndicator color={Brand.primary} />
                <Text style={styles.passPlaceholderText}>Generating your pass…</Text>
              </View>
            )}
            <Text style={styles.passCaption}>
              Present this QR code when you arrive to check in faster.
            </Text>
            {saveFailed && (
              <View style={styles.saveNotice} accessibilityRole="alert">
                <Text style={styles.saveNoticeText}>
                  We couldn&apos;t save this booking to your account, but your reference
                  number below is valid. You can show this pass at the facility.
                </Text>
              </View>
            )}
          </View>

          <Pressable
            onPress={() => router.replace('/appointment')}
            accessibilityRole="button"
            accessibilityLabel="View my appointments"
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>View My Appointments</Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace('/')}
            accessibilityRole="button"
            accessibilityLabel="Go to home screen"
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Text style={styles.secondaryButtonText}>Done</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.background,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing.two,
  },
  headerSpacer: {
    width: 44,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.textPrimary,
  },
  pressed: {
    opacity: 0.7,
  },
  successBlock: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Brand.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Brand.textPrimary,
  },
  successSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: Brand.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.three,
  },
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
    fontSize: 12,
    fontWeight: '700',
    color: Brand.textSecondary,
    letterSpacing: 0.5,
    marginBottom: Spacing.one,
  },
  refLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  refNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: Brand.textPrimary,
    fontFamily: 'monospace',
    letterSpacing: 1,
    flexShrink: 1,
  },
  copyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Brand.background,
  },
  copyText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.primary,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.background,
  },
  summaryLabel: {
    fontSize: 14,
    color: Brand.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.textPrimary,
    flexShrink: 1,
    textAlign: 'right',
  },
  passCard: {
    backgroundColor: Brand.surface,
    borderRadius: 16,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: Brand.border,
    borderStyle: 'dashed',
  },
  passLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.textSecondary,
    letterSpacing: 0.5,
  },
  passCaption: {
    fontSize: 13,
    color: Brand.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  passPlaceholder: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  passPlaceholderText: {
    fontSize: 13,
    color: Brand.textSecondary,
  },
  saveNotice: {
    backgroundColor: Brand.warningBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Brand.warning,
    padding: Spacing.three,
  },
  saveNoticeText: {
    color: Brand.warning,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: Brand.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: Brand.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  centered: {
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
    backgroundColor: Brand.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.textPrimary,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    color: Brand.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
