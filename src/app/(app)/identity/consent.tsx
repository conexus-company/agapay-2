import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useConsent, type ConsentField, type TransactionType } from '@/hooks/use-consent';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const AVAILABLE_FIELDS: { key: ConsentField; label: string; alwaysOn?: boolean }[] = [
  { key: 'full_name', label: 'Full Name', alwaysOn: true },
  { key: 'birth_date', label: 'Birth Date', alwaysOn: true },
  { key: 'middle_name', label: 'Middle Name' },
  { key: 'suffix', label: 'Suffix' },
];

type ConsentParams = {
  transactionType?: string;
  facilityId?: string;
  facilityName?: string;
};

export default function ConsentScreen() {
  const params = useLocalSearchParams<ConsentParams>();
  const theme = useTheme();
  const { create, rememberPreferences, setRememberPreferences } = useConsent();

  const transactionType = (params.transactionType ?? 'appointment') as TransactionType;
  const facilityName = params.facilityName ?? 'this facility';
  const facilityId = params.facilityId;

  const [selectedFields, setSelectedFields] = useState<ConsentField[]>(
    AVAILABLE_FIELDS.filter((f) => f.alwaysOn).map((f) => f.key)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleField = useCallback((field: ConsentField, alwaysOn: boolean | undefined) => {
    if (alwaysOn) return;
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  }, []);

  const handleConfirm = useCallback(async () => {
    setSubmitting(true);
    setError(null);

    const consent = await create({
      type: transactionType,
      facilityId,
      fields: selectedFields,
    });

    setSubmitting(false);

    if (consent) {
      router.back();
    } else {
      setError('Failed to record consent. Please try again.');
    }
  }, [create, transactionType, facilityId, selectedFields]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Share your verified identity?</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Choose which verified fields to share with {facilityName}.
          </Text>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Fields to share</Text>

          {AVAILABLE_FIELDS.map((field) => {
            const isSelected = selectedFields.includes(field.key);
            const isLocked = field.alwaysOn;

            return (
              <Pressable
                key={field.key}
                onPress={() => toggleField(field.key, field.alwaysOn)}
                style={({ pressed }) => [
                  styles.fieldRow,
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={`Share ${field.label}`}>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>{field.label}</Text>
                {isLocked && (
                  <Text style={[styles.lockedLabel, { color: theme.textSecondary }]}>Required</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => setRememberPreferences(!rememberPreferences)}
          style={styles.rememberRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: rememberPreferences }}
          accessibilityLabel="Remember my preference for similar services">
          <View style={[styles.checkbox, rememberPreferences && styles.checkboxSelected]}>
            {rememberPreferences && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={[styles.rememberLabel, { color: theme.textSecondary }]}>
            Remember my preference for similar services
          </Text>
        </Pressable>

        <View style={styles.actions}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.cancelButton, { borderColor: theme.textSecondary }]}
            accessibilityRole="button"
            accessibilityLabel="Cancel and go back">
            <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
          </Pressable>

          <Pressable
            onPress={handleConfirm}
            disabled={submitting || selectedFields.length === 0}
            style={({ pressed }) => [
              styles.confirmButton,
              pressed && styles.confirmPressed,
              (submitting || selectedFields.length === 0) && styles.confirmDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Confirm and continue">
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.confirmButtonText}>Confirm &amp; Continue</Text>
            )}
          </Pressable>
        </View>

        <Text style={[styles.privacyNote, { color: theme.textSecondary }]}>
          Your data is shared only with the selected facility and expires after your appointment.
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four },
  header: {
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.one,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E6EC',
    padding: Spacing.four,
    gap: Spacing.two,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.one,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  lockedLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  rememberLabel: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  cancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 2,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  confirmPressed: {
    opacity: 0.85,
  },
  confirmDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  privacyNote: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingBottom: BottomTabInset + Spacing.three,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    marginBottom: Spacing.two,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
});
