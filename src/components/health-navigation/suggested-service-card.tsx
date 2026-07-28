import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { SPECIALTY_ICONS } from '@/components/health-navigation/specialty-icon';
import { AuthColors } from '@/constants/auth-theme';
import { Spacing } from '@/constants/theme';
import type { TriageResult } from '@/lib/health-navigation-types';

// Confidence at/above this threshold shows the "Best Match" badge. Not
// specified by design yet — 80 chosen as a reasonable cutoff between the
// "vague input" (50-70) and "specific input" (85-95) ranges the triage
// prompt targets.
export const BEST_MATCH_THRESHOLD = 80;

export function SuggestedServiceCard({ result }: { result: TriageResult }) {
  const isBestMatch = result.confidence >= BEST_MATCH_THRESHOLD;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <Ionicons name={SPECIALTY_ICONS[result.specialty]} size={22} color={AuthColors.primary} />
          </View>
          <View>
            <Text style={styles.label}>SUGGESTED SERVICE</Text>
            <Text style={styles.specialty}>{result.specialty}</Text>
          </View>
        </View>
        {isBestMatch && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Best Match</Text>
          </View>
        )}
      </View>

      <View style={styles.explanationBox}>
        <Text style={styles.explanationText}>{result.explanation}</Text>
      </View>

      <View style={styles.confidenceRow}>
        <Text style={styles.confidenceLabel}>Recommendation confidence</Text>
        <Text style={styles.confidenceValue}>{result.confidence}%</Text>
      </View>
      <View style={styles.confidenceTrack}>
        <View style={[styles.confidenceFill, { width: `${result.confidence}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AuthColors.surface,
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: AuthColors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  specialty: {
    color: AuthColors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: '#FACC15',
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#78350F',
    fontSize: 12,
    fontWeight: '700',
  },
  explanationBox: {
    backgroundColor: AuthColors.background,
    borderRadius: 14,
    padding: Spacing.three,
  },
  explanationText: {
    color: AuthColors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  confidenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confidenceLabel: {
    color: AuthColors.textSecondary,
    fontSize: 13,
  },
  confidenceValue: {
    color: AuthColors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  confidenceTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: AuthColors.border,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: AuthColors.primary,
  },
});
