import { StyleSheet, Text, View } from 'react-native';

import { AuthColors } from '@/constants/auth-theme';
import { QrDisplay } from '@/components/health-profile/qr-display';
import { VerificationBadge } from '@/components/health-profile/verification-badge';

export function HealthIdCard({
  fullName,
  healthId,
  qrPayload,
  verificationLevel,
}: {
  fullName: string | null;
  healthId: string;
  qrPayload: string;
  verificationLevel: string;
}) {
  return (
    <View style={styles.card}>
      <VerificationBadge level={verificationLevel} />

      <View style={styles.identity}>
        <Text
          style={styles.name}
          accessibilityRole="header"
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.75}>
          {fullName ?? 'AGAPAY Citizen'}
        </Text>
        <Text style={styles.healthIdLabel}>Digital Health ID</Text>
        <Text selectable style={styles.healthId}>
          {healthId}
        </Text>
      </View>

      <QrDisplay value={qrPayload} />

      <Text style={styles.qrCaption}>
        Show this QR code at the clinic or hospital front desk to check in.
      </Text>

      <Text style={styles.reassurance}>
        This ID confirms who you are — it does not share your medical history.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AuthColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AuthColors.border,
    padding: 20,
    gap: 16,
    alignItems: 'center',
  },
  identity: {
    alignItems: 'center',
    gap: 4,
  },
  name: {
    color: AuthColors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  healthIdLabel: {
    color: AuthColors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  healthId: {
    color: AuthColors.primary,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  qrCaption: {
    color: AuthColors.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  reassurance: {
    color: AuthColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
