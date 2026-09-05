import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, AppState, type AppStateStatus, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthColors } from '@/constants/auth-theme';
import { Spacing } from '@/constants/theme';
import { TimelineEntry } from '@/components/journey/timeline-entry';
import { useAuth } from '@/contexts/auth-context';
import { resolveSsoSubjectId, type HealthProfile } from '@/lib/health-profile';
import { loadHealthProfile } from '@/lib/health-profile-storage';
import { buildJourneyTimeline, type JourneyEvent } from '@/lib/journey';

// How often the timeline re-fetches while the screen is focused and the app
// is foregrounded — same interval as use-queue-status.ts's polling.
const REFRESH_INTERVAL_MS = 20_000;

export default function JourneyScreen() {
  const { session } = useAuth();
  const [events, setEvents] = useState<JourneyEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const healthProfileRef = useRef<HealthProfile | null>(null);

  const refresh = useCallback(async () => {
    if (!healthProfileRef.current) {
      healthProfileRef.current = await loadHealthProfile();
    }
    const citizenToken = session?.profile ? resolveSsoSubjectId(session.profile) : null;
    const timeline = await buildJourneyTimeline(healthProfileRef.current, citizenToken);
    setEvents(timeline);
    setIsLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      refresh();

      const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
      const appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
        if (next === 'active') refresh();
      });

      return () => {
        clearInterval(interval);
        appStateSub.remove();
      };
    }, [refresh]),
  );

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
