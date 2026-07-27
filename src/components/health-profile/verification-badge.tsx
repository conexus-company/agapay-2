import { StyleSheet, Text, View } from 'react-native';

// Keyed by health_profiles.verification_level. Add higher levels here as
// A-003 (eVerify) / A-004 (Face Liveness) ship — nothing else about this
// component needs to change.
const VERIFICATION_LEVELS: Record<string, { label: string; background: string; foreground: string }> = {
  sso_only: {
    label: 'Identity Verified — eGov SSO',
    background: '#DBEAFE',
    foreground: '#1D4ED8',
  },
  sso_eVerify: {
    label: 'Identity Verified — eGov SSO + eVerify',
    background: '#DBEAFE',
    foreground: '#1D4ED8',
  },
  sso_eVerify_faceLiveness: {
    label: 'Identity Verified — Full Verification',
    background: '#D1FAE5',
    foreground: '#047857',
  },
};

const FALLBACK_LEVEL = { label: 'Identity Verified', background: '#DBEAFE', foreground: '#1D4ED8' };

export function VerificationBadge({ level }: { level: string }) {
  const known = VERIFICATION_LEVELS[level];

  if (__DEV__ && !known) {
    // Citizen still sees a calm generic badge (below) — this is a dev-only
    // signal so a backend typo or unreleased level string doesn't hide silently.
    console.warn(`VerificationBadge: unrecognized verification_level "${level}" — showing generic fallback badge`);
  }

  const { label, background, foreground } = known ?? FALLBACK_LEVEL;

  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.text, { color: foreground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
