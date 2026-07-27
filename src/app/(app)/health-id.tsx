import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HealthIdCard } from '@/components/health-profile/health-id-card';
import { AuthColors } from '@/constants/auth-theme';
import { Spacing } from '@/constants/theme';
import type { HealthProfile } from '@/lib/health-profile';
import { loadHealthProfile } from '@/lib/health-profile-storage';

export default function HealthIdScreen() {
  const [healthProfile, setHealthProfile] = useState<HealthProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    loadHealthProfile().then((stored) => {
      if (cancelled) return;
      setHealthProfile(stored);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

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
          <Text style={styles.headerTitle}>Digital Health ID</Text>
        </View>

        {isLoading ? (
          <View style={styles.centerSection}>
            <ActivityIndicator color={AuthColors.primary} size="large" />
          </View>
        ) : healthProfile ? (
          <ScrollView contentContainerStyle={styles.content}>
            <HealthIdCard
              fullName={healthProfile.full_name}
              healthId={healthProfile.health_id}
              qrPayload={healthProfile.qr_payload}
              verificationLevel={healthProfile.verification_level}
            />
          </ScrollView>
        ) : (
          <View style={styles.centerSection}>
            <Text style={styles.emptyText}>
              We couldn&apos;t find your Health ID. Go back to Home to set it up.
            </Text>
          </View>
        )}
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
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  backButton: {
    padding: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AuthColors.text,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },
  emptyText: {
    color: AuthColors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
