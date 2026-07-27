import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DisclaimerFooter } from '@/components/health-navigation/disclaimer-footer';
import { EmergencyBanner } from '@/components/health-navigation/emergency-banner';
import { FacilityList, FindFacilitiesButton } from '@/components/health-navigation/facility-list';
import { SuggestedServiceCard } from '@/components/health-navigation/suggested-service-card';
import { RetryErrorCard } from '@/components/health-profile/retry-error-card';
import { AuthColors } from '@/constants/auth-theme';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { findFacilities } from '@/lib/facilities';
import { getCurrentLocation } from '@/lib/geolocation';
import type { Facility, Specialty, TriageResult } from '@/lib/health-navigation-types';
import { triageConcern } from '@/lib/triage-client';

export default function HealthNavigationResultScreen() {
  const { concern } = useLocalSearchParams<{ concern: string }>();

  const [triageStatus, setTriageStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [triageAttempt, setTriageAttempt] = useState(0);

  const [facilities, setFacilities] = useState<Facility[] | null>(null);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [facilitiesError, setFacilitiesError] = useState<string | null>(null);
  const [facilitiesAttempt, setFacilitiesAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function runTriage() {
      setTriageStatus('loading');
      const result = await triageConcern(concern ?? '');
      if (cancelled) return;
      if (!result.ok) {
        setTriageStatus('error');
        return;
      }
      setTriageResult(result.data);
      setTriageStatus('ready');
    }

    runTriage();
    return () => {
      cancelled = true;
    };
  }, [concern, triageAttempt]);

  // Facility lookup runs automatically once Stage 1 resolves — no separate
  // tap required, matching the reference screenshot showing facilities
  // already populated on the result screen. The "Find Facilities" button
  // re-triggers this by bumping facilitiesAttempt.
  useEffect(() => {
    if (triageStatus !== 'ready' || !triageResult) return;
    let cancelled = false;
    const specialty: Specialty = triageResult.specialty;

    async function runFacilityLookup() {
      setFacilitiesLoading(true);
      setFacilitiesError(null);

      const locationResult = await getCurrentLocation();
      if (cancelled) return;
      if (!locationResult.ok) {
        setFacilitiesError(
          locationResult.kind === 'invalid_response'
            ? locationResult.message
            : 'Could not access your location right now.',
        );
        setFacilitiesLoading(false);
        return;
      }

      const facilitiesResult = await findFacilities(specialty, locationResult.data.lat, locationResult.data.lng);
      if (cancelled) return;
      if (!facilitiesResult.ok) {
        setFacilitiesError('Could not load nearby facilities right now. Please try again.');
        setFacilitiesLoading(false);
        return;
      }

      setFacilities(facilitiesResult.data);
      setFacilitiesLoading(false);
    }

    runFacilityLookup();
    return () => {
      cancelled = true;
    };
  }, [triageStatus, triageResult, facilitiesAttempt]);

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={22} color={AuthColors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Recommended for You</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {triageStatus === 'loading' ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator color={AuthColors.primary} size="large" />
              <Text style={styles.loadingTitle}>Finding the right service for you</Text>
              {concern ? <Text style={styles.loadingText}>“{concern}”</Text> : null}
            </View>
          ) : triageStatus === 'error' || !triageResult ? (
            <RetryErrorCard
              message="We couldn't get a recommendation right now. Please check your connection and try again."
              onRetry={() => setTriageAttempt((n) => n + 1)}
              retryAccessibilityLabel="Retry getting a recommendation"
            />
          ) : (
            <>
              {/* ── Concern Summary ──────────────────────────────────── */}
              <View style={styles.concernSummaryCard}>
                <View style={styles.concernSummaryRow}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={AuthColors.primary} />
                  <View style={styles.concernSummaryText}>
                    <Text style={styles.concernSummaryLabel}>Your concern</Text>
                    <Text style={styles.concernSummaryValue}>{concern}</Text>
                  </View>
                  <Pressable
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    accessibilityLabel="Edit your concern"
                    style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
                    <Ionicons name="create-outline" size={16} color={AuthColors.primary} />
                    <Text style={styles.editButtonText}>Edit</Text>
                  </Pressable>
                </View>
              </View>

              {triageResult.is_emergency ? (
                <EmergencyBanner />
              ) : (
                <SuggestedServiceCard result={triageResult} />
              )}

              <FacilityList
                title={triageResult.is_emergency ? 'Nearest Emergency Facilities' : 'Available Facilities'}
                facilities={facilities}
                isLoading={facilitiesLoading}
                errorMessage={facilitiesError}
              />

              <FindFacilitiesButton
                onPress={() => setFacilitiesAttempt((n) => n + 1)}
                disabled={facilitiesLoading}
              />

              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Ask again"
                style={({ pressed }) => [styles.askAgainButton, pressed && styles.pressed]}>
                <Ionicons name="refresh" size={16} color={AuthColors.primary} />
                <Text style={styles.askAgainButtonText}>Ask Again About Something Else</Text>
              </Pressable>
            </>
          )}

          <DisclaimerFooter />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AuthColors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  backButton: {
    padding: Spacing.one,
  },
  headerSpacer: {
    width: 22 + Spacing.one * 2,
  },
  pressed: {
    opacity: 0.7,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: AuthColors.text,
    textAlign: 'center',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    gap: Spacing.three,
  },
  // ── Center Block / Loading ───────────────────────────────────────
  centerBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.six,
  },
  loadingTitle: {
    color: AuthColors.text,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingText: {
    color: AuthColors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  // ── Concern Summary ───────────────────────────────────────────────
  concernSummaryCard: {
    backgroundColor: AuthColors.surface,
    borderRadius: 16,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: AuthColors.border,
  },
  concernSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  concernSummaryText: {
    flex: 1,
    gap: 2,
  },
  concernSummaryLabel: {
    color: AuthColors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  concernSummaryValue: {
    color: AuthColors.text,
    fontSize: 14,
    lineHeight: 19,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F0F4FF',
  },
  editButtonText: {
    color: AuthColors.primary,
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Ask Again ─────────────────────────────────────────────────────
  askAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderColor: AuthColors.primary,
    borderRadius: 999,
    paddingVertical: Spacing.three,
  },
  askAgainButtonText: {
    color: AuthColors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
});
