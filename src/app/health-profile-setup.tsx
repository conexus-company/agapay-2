import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RetryErrorCard } from '@/components/health-profile/retry-error-card';
import { AuthColors } from '@/constants/auth-theme';
import { useAuth } from '@/contexts/auth-context';
import { useHealthProfileSetup } from '@/contexts/health-profile-setup-context';
import { createOrGetHealthProfile } from '@/lib/health-profile';
import { saveHealthProfile } from '@/lib/health-profile-storage';
import type { ApiResult } from '@/lib/api-result';

type ScreenState = 'creating' | 'error';

function describeFailure(result: ApiResult<unknown>): string {
  if (!result.ok && result.kind === 'network_error') {
    return "We couldn't reach the AGAPAY profile service. Check your connection and try again.";
  }
  return "We couldn't set up your AGAPAY profile right now. Please try again.";
}

export default function HealthProfileSetupScreen() {
  const { pendingSession, clearPendingSession } = useHealthProfileSetup();
  const { signIn } = useAuth();
  const [state, setState] = useState<ScreenState>('creating');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!pendingSession) {
      // No pending session to act on (e.g. a deep link straight to this
      // screen) — there's nothing to set up, so send the citizen back to sign in.
      router.replace('/auth');
      return;
    }

    let cancelled = false;

    createOrGetHealthProfile(pendingSession.profile).then(async (result) => {
      if (cancelled) return;

      if (!result.ok) {
        setErrorMessage(describeFailure(result));
        setState('error');
        return;
      }

      await saveHealthProfile(result.data);
      if (cancelled) return;

      clearPendingSession();
      // Flips auth status to signedIn — RootNavigator then swaps this
      // signedOut-guarded screen for the (app) tabs automatically.
      await signIn(pendingSession);
    });

    return () => {
      cancelled = true;
    };
  }, [pendingSession, signIn, clearPendingSession, attempt]);

  const retry = useCallback(() => {
    setState('creating');
    setErrorMessage(null);
    setAttempt((n) => n + 1);
  }, []);

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {state === 'creating' ? (
            <Animated.View entering={FadeIn.duration(200)} style={styles.statusBlock}>
              <ActivityIndicator color={AuthColors.primary} size="large" />
              <Text style={styles.statusText} accessibilityLiveRegion="polite">
                Setting up your AGAPAY profile…
              </Text>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.duration(200)} style={styles.errorWrapper}>
              <RetryErrorCard
                message={errorMessage ?? "We couldn't set up your AGAPAY profile right now. Please try again."}
                onRetry={retry}
                retryAccessibilityLabel="Retry setting up your AGAPAY profile"
              />
            </Animated.View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AuthColors.background },
  safeArea: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  statusBlock: { alignItems: 'center', gap: 16 },
  statusText: { color: AuthColors.textSecondary, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  errorWrapper: { width: '100%', alignItems: 'center' },
});
