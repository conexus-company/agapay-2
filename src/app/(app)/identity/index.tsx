import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'qrcode';

import { useDigitalHealthId } from '@/hooks/use-digital-health-id';
import { BottomTabInset, Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const light = Colors.light;

function maskBirthDate(date: string | null): string {
  if (!date) return '**/**/****';
  const parts = date.split('-');
  if (parts.length !== 3) return '**/**/****';
  return `**/${parts[1]}/${parts[0]}`;
}

export default function IdentityScreen() {
  const theme = useTheme();
  const { id, fullName, birthDate, isRevoked, qrPayload, loading, error, refresh, create } = useDigitalHealthId();
  const [qrDataUri, setQrDataUri] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!qrPayload) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting derived state when source changes
      setQrDataUri(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(qrPayload, { width: 240, margin: 2 }, (err: Error | null | undefined, url: string) => {
      if (!err && !cancelled) {
        setQrDataUri(url);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [qrPayload]);

  const hasId = id !== null && !isRevoked;

  const handleCreate = useCallback(async () => {
    setCreating(true);
    await create();
    if (mountedRef.current) setCreating(false);
  }, [create]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={light.text} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Digital Health ID</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Your verified healthcare identity, connected once.
          </Text>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {hasId && qrDataUri ? (
          <View style={styles.card}>
            <View style={styles.qrContainer}>
              <Image source={{ uri: qrDataUri }} style={styles.qrImage} contentFit="contain" />
            </View>

            <View style={styles.infoSection}>
              <Text style={[styles.name, { color: theme.text }]}>{fullName}</Text>
              <Text style={[styles.dob, { color: theme.textSecondary }]}>
                {maskBirthDate(birthDate)}
              </Text>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Active</Text>
              </View>
            </View>

            <Text style={[styles.qrHint, { color: theme.textSecondary }]}>
              Show this QR code at check-in. It does not expose your medical history.
            </Text>

            <View style={styles.actions}>
              <Pressable
                onPress={() => router.push('/identity/privacy')}
                style={[styles.secondaryButton, { borderColor: theme.textSecondary }]}
                accessibilityRole="button"
                accessibilityLabel="Manage privacy settings">
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Manage Privacy</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>+</Text>
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Digital Health ID yet</Text>
            <Text style={[styles.emptyDescription, { color: theme.textSecondary }]}>
              Create your Digital Health ID to use consent-based data reuse across healthcare services.
            </Text>
            <Pressable
              onPress={handleCreate}
              disabled={creating}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}
              accessibilityRole="button"
              accessibilityLabel="Create Digital Health ID">
              {creating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Create Digital Health ID</Text>
              )}
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.one,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: light.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E6EC',
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  qrContainer: {
    width: 240,
    height: 240,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrImage: {
    width: 240,
    height: 240,
  },
  infoSection: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
    textAlign: 'center',
  },
  dob: {
    fontSize: 14,
    lineHeight: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.one,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#059669',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  qrHint: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    width: '100%',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F0F0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconText: {
    fontSize: 32,
    fontWeight: '300',
    color: '#6B7280',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: Spacing.two,
    width: '100%',
    maxWidth: 320,
  },
  primaryPressed: {
    opacity: 0.85,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
