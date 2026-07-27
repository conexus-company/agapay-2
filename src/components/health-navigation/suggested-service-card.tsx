import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { SPECIALTY_ICONS } from '@/components/health-navigation/specialty-icon';
import { AuthColors } from '@/constants/auth-theme';
import { Spacing } from '@/constants/theme';
import type { TriageResult } from '@/lib/health-navigation-types';

// Confidence at/above this threshold shows the "Best Match" badge.
export const BEST_MATCH_THRESHOLD = 80;

/** Maps confidence to a severity/urgency level for the indicator badge. */
function getConfidenceLevel(confidence: number): {
  label: string;
  color: string;
  background: string;
  icon: keyof typeof Ionicons.glyphMap;
} {
  if (confidence >= 80) {
    return {
      label: 'High Confidence',
      color: '#065F46',
      background: '#D1FAE5',
      icon: 'checkmark-circle',
    };
  }
  if (confidence >= 50) {
    return {
      label: 'Moderate Confidence',
      color: '#92400E',
      background: '#FEF3C7',
      icon: 'help-circle',
    };
  }
  return {
    label: 'Low Confidence',
    color: '#991B1B',
    background: '#FEE2E2',
    icon: 'alert-circle',
  };
}

/** Guidance tips mapped by specialty — shown as a "What to Expect" section. */
function getGuidanceTips(specialty: string): string[] {
  const tips: Record<string, string[]> = {
    'General Practice': [
      'Bring a list of your current medications and any relevant medical records.',
      'Prepare a brief timeline of your symptoms to share with the doctor.',
      'Note any questions you have before your visit.',
    ],
    Pediatrics: [
      'Bring your child\'s immunization record and any growth charts if available.',
      'Note your child\'s symptoms, temperature history, and appetite changes.',
      'Write down any questions about developmental milestones.',
    ],
    'OB-GYN': [
      'Bring your menstrual cycle dates or pregnancy records if applicable.',
      'Prepare a list of any symptoms, pain patterns, or concerns.',
      'Note the date of your last Pap smear or well-woman exam.',
    ],
    Dermatology: [
      'Avoid wearing makeup or lotions on the affected area before your visit.',
      'Note when the skin condition first appeared and any triggers.',
      'Take photos of any changing moles or rashes for reference.',
    ],
    Orthopedics: [
      'Wear comfortable clothing that allows access to the affected area.',
      'Bring any previous X-rays, MRIs, or imaging results.',
      'Note which movements cause pain and when the discomfort started.',
    ],
    Cardiology: [
      'Bring a list of all medications and their dosages.',
      'Note any family history of heart conditions.',
      'Record any episodes of chest pain, shortness of breath, or palpitations.',
    ],
    'Emergency/Urgent Care': [
      'Call 911 or go to the nearest emergency room immediately.',
      'Do not eat or drink anything unless instructed by medical staff.',
      'Bring your ID, insurance card, and emergency contact information.',
    ],
    Dental: [
      'Brush and floss before your appointment if possible.',
      'Note which tooth or area is causing discomfort and when it started.',
      'Bring a list of any medications you are taking.',
    ],
    'Mental Health': [
      'Be open and honest about your feelings and experiences.',
      'Note any changes in sleep, appetite, or mood patterns.',
      'Write down what you hope to achieve from the consultation.',
    ],
    ENT: [
      'Note when symptoms started and if they are seasonal or persistent.',
      'Bring a list of any allergies or previous ENT treatments.',
      'Avoid using ear drops or nasal sprays before your appointment.',
    ],
    Ophthalmology: [
      'Bring your current eyeglasses or contact lenses.',
      'Note any changes in vision, floaters, or eye discomfort.',
      'Avoid driving if you are experiencing vision problems.',
    ],
  };
  return tips[specialty] ?? [
    'Prepare a brief summary of your symptoms and concerns.',
    'Bring any relevant medical records or referral documents.',
    'Write down questions you want to ask the healthcare provider.',
  ];
}

export function SuggestedServiceCard({ result }: { result: TriageResult }) {
  const isBestMatch = result.confidence >= BEST_MATCH_THRESHOLD;
  const confidenceLevel = getConfidenceLevel(result.confidence);
  const guidanceTips = getGuidanceTips(result.specialty);

  return (
    <View style={styles.card}>
      {/* ── Header: Specialty + Badges ──────────────────────────────── */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <Ionicons name={SPECIALTY_ICONS[result.specialty]} size={22} color={AuthColors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.label}>SUGGESTED SERVICE</Text>
            <Text style={styles.specialty}>{result.specialty}</Text>
          </View>
        </View>
        {isBestMatch && (
          <View style={styles.bestMatchBadge}>
            <Ionicons name="star" size={11} color="#78350F" />
            <Text style={styles.bestMatchBadgeText}>Best Match</Text>
          </View>
        )}
      </View>

      {/* ── Confidence Level Badge ─────────────────────────────────── */}
      <View style={[styles.confidenceBadge, { backgroundColor: confidenceLevel.background }]}>
        <Ionicons name={confidenceLevel.icon} size={14} color={confidenceLevel.color} />
        <Text style={[styles.confidenceBadgeText, { color: confidenceLevel.color }]}>
          {confidenceLevel.label}
        </Text>
      </View>

      {/* ── Explanation ────────────────────────────────────────────── */}
      <View style={styles.explanationBox}>
        <View style={styles.sectionHeader}>
          <Ionicons name="information-circle-outline" size={16} color={AuthColors.primary} />
          <Text style={styles.sectionTitle}>Why this recommendation</Text>
        </View>
        <Text style={styles.explanationText}>{result.explanation}</Text>
      </View>

      {/* ── Confidence Bar ─────────────────────────────────────────── */}
      <View style={styles.confidenceSection}>
        <View style={styles.confidenceRow}>
          <Text style={styles.confidenceLabel}>Match confidence</Text>
          <Text style={styles.confidenceValue}>{result.confidence}%</Text>
        </View>
        <View style={styles.confidenceTrack}>
          <View
            style={[
              styles.confidenceFill,
              {
                width: `${result.confidence}%`,
                backgroundColor:
                  result.confidence >= 80
                    ? AuthColors.success
                    : result.confidence >= 50
                      ? '#D97706'
                      : AuthColors.danger,
              },
            ]}
          />
        </View>
      </View>

      {/* ── Section Divider ────────────────────────────────────────── */}
      <View style={styles.divider} />

      {/* ── What to Expect ─────────────────────────────────────────── */}
      <View style={styles.tipsSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="bulb-outline" size={16} color={AuthColors.primary} />
          <Text style={styles.sectionTitle}>What to expect</Text>
        </View>
        {guidanceTips.map((tip, index) => (
          <View key={index} style={styles.tipRow}>
            <View style={styles.tipBullet}>
              <Ionicons name="ellipse" size={5} color={AuthColors.primary} />
            </View>
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </View>

      {/* ── Section Divider ────────────────────────────────────────── */}
      <View style={styles.divider} />

      {/* ── Follow-up ──────────────────────────────────────────────── */}
      <View style={styles.followUpSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="refresh-outline" size={16} color={AuthColors.primary} />
          <Text style={styles.sectionTitle}>Follow-up suggestion</Text>
        </View>
        <Text style={styles.followUpText}>
          If your symptoms change, worsen, or do not improve within a few days, consider
          re-evaluating your condition or visiting the recommended service for a check-up.
          Always trust your instincts — seek care if something feels wrong.
        </Text>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  // ── Header ────────────────────────────────────────────────────────
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
  headerText: {
    gap: 2,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: AuthColors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  specialty: {
    color: AuthColors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  bestMatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  bestMatchBadgeText: {
    color: '#78350F',
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Confidence Level Badge ─────────────────────────────────────────
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  confidenceBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Section Headers ────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.half,
  },
  sectionTitle: {
    color: AuthColors.text,
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Explanation ────────────────────────────────────────────────────
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

  // ── Confidence Bar ─────────────────────────────────────────────────
  confidenceSection: {
    gap: Spacing.one,
  },
  confidenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confidenceLabel: {
    color: AuthColors.textSecondary,
    fontSize: 12,
  },
  confidenceValue: {
    color: AuthColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  confidenceTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: AuthColors.border,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 4,
  },

  // ── Divider ────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: AuthColors.border,
    marginVertical: Spacing.half,
  },

  // ── Tips / What to Expect ──────────────────────────────────────────
  tipsSection: {
    gap: Spacing.two,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingLeft: Spacing.one,
  },
  tipBullet: {
    width: 16,
    alignItems: 'center',
    paddingTop: 5,
  },
  tipText: {
    flex: 1,
    color: AuthColors.text,
    fontSize: 13,
    lineHeight: 18,
  },

  // ── Follow-up ──────────────────────────────────────────────────────
  followUpSection: {
    gap: Spacing.half,
  },
  followUpText: {
    color: AuthColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
