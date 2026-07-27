import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/auth-context';
import { useDigitalHealthId } from '@/hooks/use-digital-health-id';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ConsentRecord = {
  consent_id: string;
  status: string;
  expires_at: string;
  consented_fields: string[];
  transaction_type: string;
  facility_id: string | null;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function PrivacyScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const { id, fullName, isRevoked, refresh } = useDigitalHealthId();
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [loadingConsents, setLoadingConsents] = useState(true);
  const [revokingConsent, setRevokingConsent] = useState<string | null>(null);
  const [revokingHealthId, setRevokingHealthId] = useState(false);
  const [showConfirmRevokeAll, setShowConfirmRevokeAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConsents = useCallback(async () => {
    const token = session?.sessionToken;
    if (!token || !id) {
      setLoadingConsents(false);
      return;
    }

    setLoadingConsents(true);
    try {
      const response = await fetch('/api/identity/consent?transaction_type=appointment', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const body = await response.json();
        if (body.consent) {
          setConsents([body.consent]);
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoadingConsents(false);
    }
  }, [session, id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate data-fetch-on-mount pattern
      loadConsents();
    }
  }, [id, loadConsents]);

  const handleRevokeConsent = useCallback(
    async (consentId: string) => {
      const token = session?.sessionToken;
      if (!token) return;

      setRevokingConsent(consentId);
      setError(null);

      try {
        const response = await fetch('/api/identity/revoke', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ scope: 'consent', consent_id: consentId }),
        });

        if (response.ok) {
          setConsents((prev) => prev.filter((c) => c.consent_id !== consentId));
        } else {
          const body = await response.json().catch(() => null);
          setError(body?.error ?? 'Failed to revoke consent');
        }
      } catch {
        setError('Network error — check your connection');
      } finally {
        setRevokingConsent(null);
      }
    },
    [session]
  );

  const handleRevokeHealthId = useCallback(async () => {
    const token = session?.sessionToken;
    if (!token) return;

    setRevokingHealthId(true);
    setError(null);

    try {
      const response = await fetch('/api/identity/revoke', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scope: 'health_id' }),
      });

      if (response.ok) {
        await refresh();
        router.replace('/(app)/identity');
      } else {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? 'Failed to revoke Digital Health ID');
      }
    } catch {
      setError('Network error — check your connection');
    } finally {
      setRevokingHealthId(false);
      setShowConfirmRevokeAll(false);
    }
  }, [session, refresh]);

  if (isRevoked) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centered}>
            <Text style={[styles.revokedTitle, { color: theme.text }]}>Digital Health ID Revoked</Text>
            <Text style={[styles.revokedDescription, { color: theme.textSecondary }]}>
              Your Digital Health ID has been revoked. All associated consents have been voided.
            </Text>
            <Pressable
              onPress={() => router.replace('/(app)/identity')}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}
              accessibilityRole="button"
              accessibilityLabel="Create new Digital Health ID">
              <Text style={styles.primaryButtonText}>Create New Digital Health ID</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Privacy Settings</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Manage your Digital Health ID and data sharing consents.
            </Text>
          </View>

          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Digital Health ID</Text>
            <View style={styles.idRow}>
              <View style={styles.idInfo}>
                <Text style={[styles.idName, { color: theme.text }]}>{fullName ?? '—'}</Text>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Active</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Active Consents</Text>

            {loadingConsents ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={theme.text} />
              </View>
            ) : consents.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No active consents yet. When you use a service, you will be asked to consent to data sharing.
              </Text>
            ) : (
              consents.map((consent) => (
                <View key={consent.consent_id} style={styles.consentRow}>
                  <View style={styles.consentInfo}>
                    <Text style={[styles.consentType, { color: theme.text }]}>
                      {consent.transaction_type}
                    </Text>
                    <Text style={[styles.consentFields, { color: theme.textSecondary }]}>
                      {consent.consented_fields.join(', ')}
                    </Text>
                    <Text style={[styles.consentExpiry, { color: theme.textSecondary }]}>
                      Expires: {formatDate(consent.expires_at)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleRevokeConsent(consent.consent_id)}
                    disabled={revokingConsent === consent.consent_id}
                    style={({ pressed }) => [
                      styles.revokeButton,
                      pressed && { opacity: 0.7 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Revoke consent for ${consent.transaction_type}`}>
                    {revokingConsent === consent.consent_id ? (
                      <ActivityIndicator size="small" color="#DC2626" />
                    ) : (
                      <Text style={styles.revokeButtonText}>Revoke</Text>
                    )}
                  </Pressable>
                </View>
              ))
            )}
          </View>

          <View style={styles.dangerZone}>
            <Text style={[styles.dangerLabel, { color: theme.textSecondary }]}>Danger Zone</Text>

            {!showConfirmRevokeAll ? (
              <Pressable
                onPress={() => setShowConfirmRevokeAll(true)}
                style={({ pressed }) => [styles.dangerButton, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel="Revoke Digital Health ID">
                <Text style={styles.dangerButtonText}>Revoke Digital Health ID</Text>
              </Pressable>
            ) : (
              <View style={styles.confirmRevokeAll}>
                <Text style={[styles.confirmText, { color: theme.text }]}>
                  This will permanently revoke your Digital Health ID and void all consents. You can create a new one later.
                </Text>
                <View style={styles.confirmActions}>
                  <Pressable
                    onPress={() => setShowConfirmRevokeAll(false)}
                    style={[styles.cancelButton, { borderColor: theme.textSecondary }]}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel">
                    <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleRevokeHealthId}
                    disabled={revokingHealthId}
                    style={({ pressed }) => [
                      styles.confirmRevokeButton,
                      pressed && { opacity: 0.8 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Confirm revoke Digital Health ID">
                    {revokingHealthId ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.confirmRevokeButtonText}>Yes, Revoke</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </View>
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
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E6EC',
    padding: Spacing.four,
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.one,
  },
  idRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  idInfo: {
    gap: Spacing.one,
  },
  idName: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    alignSelf: 'flex-start',
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
  loadingRow: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  consentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  consentInfo: {
    flex: 1,
    gap: 2,
  },
  consentType: {
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  consentFields: {
    fontSize: 13,
    lineHeight: 18,
  },
  consentExpiry: {
    fontSize: 12,
    lineHeight: 16,
  },
  revokeButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  revokeButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  dangerZone: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  dangerLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dangerButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmRevokeAll: {
    gap: Spacing.two,
  },
  confirmText: {
    fontSize: 14,
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: Spacing.two,
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
  confirmRevokeButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmRevokeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
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
  revokedTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  revokedDescription: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
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
