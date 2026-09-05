import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthColors } from '@/constants/auth-theme';
import { DEV_TOOLS_ENABLED } from '@/constants/dev-tools';
import { getEgovLivenessRedirectUri } from '@/constants/egov-sso';
import { useHealthProfileSetup } from '@/contexts/health-profile-setup-context';
import { getVerificationStatus, startVerification } from '@/lib/egov-sso-client';

type RunState =
  | { status: 'idle' }
  | { status: 'starting' }
  | { status: 'completed'; profile: unknown }
  | { status: 'error'; message: string };

/**
 * Dev-only sandbox tester: lets a tester paste a manually-obtained eGov
 * sandbox exchange_code and run the SSO flow without going through the real
 * WebBrowser SSO redirect. Face Liveness + eVerify are temporarily
 * disconnected here too, matching the real login screen.
 */
export default function DevLoginScreen() {
  const { beginSetup } = useHealthProfileSetup();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<RunState>({ status: 'idle' });
  const [showDetails, setShowDetails] = useState(false);

  // Hooks above run unconditionally; nothing below executes in production.
  if (!DEV_TOOLS_ENABLED) {
    return null;
  }

  const start = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setShowDetails(false);
    setResult({ status: "starting" });

    const startResult = await startVerification(
      trimmed,
      getEgovLivenessRedirectUri(),
    );
    if (!startResult.ok) {
      setResult({
        status: "error",
        message: `Start failed: ${JSON.stringify(startResult)}`,
      });
      return;
    }

    setResult({ status: 'completed', profile: startResult.data.profile });
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Dev: Sandbox eGov SSO</Text>
          <Text style={styles.subtitle}>
            Paste a sandbox exchange_code from the eGov test portal to run the SSO exchange. This screen is
            excluded from production builds.
          </Text>

          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="exchange_code"
            placeholderTextColor={AuthColors.textSecondary}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Sandbox exchange code input"
          />

          <Pressable
            onPress={start}
            disabled={result.status === 'starting'}
            accessibilityRole="button"
            accessibilityLabel="Start verification"
            style={styles.button}
          >
            {result.status === "starting" ? (
              <ActivityIndicator color={AuthColors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Start verification</Text>
            )}
          </Pressable>

          {result.status === "error" && (
            <Animated.View entering={FadeIn.duration(200)}>
              <Text style={styles.error}>{result.message}</Text>
            </Animated.View>
          )}

          {result.status === 'completed' && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.resultBlock}>
              <Text style={styles.successText}>✓ SSO profile retrieved</Text>

              <Pressable
                onPress={() => {
                  beginSetup({ profile: result.profile, everify: null });
                  router.push('/health-profile-setup');
                }}
                accessibilityRole="button"
                accessibilityLabel="Use this identity and continue into the app"
                style={[styles.button, styles.useButton]}
              >
                <Text style={styles.buttonText}>
                  Use this identity &amp; continue
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setShowDetails((visible) => !visible)}
                accessibilityRole="button"
                accessibilityLabel={
                  showDetails ? "Hide raw response" : "Show raw response"
                }
                style={styles.toggle}
              >
                <Text style={styles.toggleText}>
                  {showDetails ? "Hide raw response ▲" : "Show raw response ▼"}
                </Text>
              </Pressable>

              {showDetails && (
                <Animated.View
                  entering={FadeIn.duration(180)}
                  exiting={FadeOut.duration(120)}
                  style={styles.details}
                >
                  <Text style={styles.resultLabel}>profile</Text>
                  <Text selectable style={styles.resultText}>
                    {JSON.stringify(result.profile, null, 2)}
                  </Text>
                </Animated.View>
              )}
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AuthColors.background },
  safeArea: { flex: 1 },
  content: { padding: 24, gap: 16 },
  title: { color: AuthColors.text, fontSize: 22, fontWeight: "700" },
  subtitle: { color: AuthColors.textSecondary, fontSize: 13, lineHeight: 18 },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AuthColors.border,
    backgroundColor: AuthColors.surface,
    color: AuthColors.text,
    paddingHorizontal: 14,
    fontFamily: "monospace",
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: AuthColors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  useButton: { marginTop: 0 },
  buttonText: { color: AuthColors.onPrimary, fontSize: 15, fontWeight: "600" },
  error: { color: AuthColors.danger, fontSize: 13 },
  resultBlock: {
    gap: 12,
    backgroundColor: AuthColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AuthColors.border,
    padding: 14,
  },
  successText: { color: AuthColors.success, fontSize: 14, fontWeight: '600' },
  toggle: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  toggleText: { color: AuthColors.textSecondary, fontSize: 12, fontWeight: '600' },
  details: { gap: 6 },
  resultLabel: { color: AuthColors.textSecondary, fontSize: 11, textTransform: 'uppercase', marginTop: 8 },
  resultText: { color: AuthColors.text, fontSize: 12, fontFamily: 'monospace' },
});
