import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthColors } from '@/constants/auth-theme';
import { Spacing } from '@/constants/theme';
import { TimelineEntry } from '@/components/journey/timeline-entry';
import type { HealthProfile } from '@/lib/health-profile';
import { loadHealthProfile } from '@/lib/health-profile-storage';
import { buildJourneyTimeline } from '@/lib/journey';

export default function JourneyScreen() {
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

  const events = useMemo(() => buildJourneyTimeline(healthProfile), [healthProfile]);

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
          <Text style={styles.headerTitle}>Journey Timeline</Text>
        </View>

        {isLoading ? (
          <View style={styles.centerSection}>
            <ActivityIndicator color={AuthColors.primary} size="large" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {events.map((event, index) => (
              <TimelineEntry key={event.id} event={event} isLast={index === events.length - 1} />
            ))}
          </ScrollView>
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
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
  },
});
