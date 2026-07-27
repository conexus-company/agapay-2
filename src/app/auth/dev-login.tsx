import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthColors } from '@/constants/auth-theme';
import { useHealthProfileSetup } from '@/contexts/health-profile-setup-context';
import { exchangeCodeForSession, fetchCitizenProfile } from '@/lib/egov-sso-client';

type RunState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; sessionToken: string; profile: unknown }
  | { status: 'error'; message: string };

/**
 * Dev-only sandbox tester: lets a tester paste a manually-obtained eGov
 * sandbox exchange_code and run the token exchange + profile fetch chain
 * without going through the (not-yet-available) real login page.
 */
export default function DevLoginScreen() {
  const { beginSetup } = useHealthProfileSetup();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<RunState>({ status: 'idle' });
  const [showDetails, setShowDetails] = useState(false);
  const [pendingSession, setPendingSession] = useState<{ sessionToken: string; profile: unknown } | null>(
    null
  );

  // Hooks above run unconditionally; nothing below executes in production.
  if (!__DEV__) {
    return null;
  }

  const run = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setShowDetails(false);
    setResult({ status: 'running' });

    const tokenResult = await exchangeCodeForSession(trimmed);
    if (!tokenResult.ok) {
      setResult({ status: 'error', message: `Token exchange failed: ${JSON.stringify(tokenResult)}` });
      return;
    }

    const profileResult = await fetchCitizenProfile(tokenResult.data.sessionToken);
    if (!profileResult.ok) {
      setResult({ status: 'error', message: `Profile fetch failed: ${JSON.stringify(profileResult)}` });
      return;
    }

    setResult({ status: 'done', sessionToken: tokenResult.data.sessionToken, profile: profileResult.data });
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Dev: Sandbox eGov SSO</Text>
          <Text style={styles.subtitle}>
            Paste a sandbox exchange_code from the eGov test portal to run the token exchange and profile fetch
            chain. This screen is excluded from production builds.
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
            onPress={run}
            disabled={result.status === 'running'}
            accessibilityRole="button"
            accessibilityLabel="Run token exchange"
            style={styles.button}>
            {result.status === 'running' ? (
              <ActivityIndicator color={AuthColors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Run token exchange</Text>
            )}
          </Pressable>

          {result.status === 'error' && (
            <Animated.View entering={FadeIn.duration(200)}>
              <Text style={styles.error}>{result.message}</Text>
            </Animated.View>
          )}

          {result.status === 'done' && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.resultBlock}>
              <Text style={styles.successText}>✓ Token exchange &amp; profile fetch succeeded</Text>

              <Pressable
                onPress={() => setPendingSession({ sessionToken: result.sessionToken, profile: result.profile })}
                accessibilityRole="button"
                accessibilityLabel="Use this session and continue into the app"
                style={[styles.button, styles.useButton]}>
                <Text style={styles.buttonText}>Use this session &amp; continue</Text>
              </Pressable>

              <Pressable
                onPress={() => setShowDetails((visible) => !visible)}
                accessibilityRole="button"
                accessibilityLabel={showDetails ? 'Hide raw response' : 'Show raw response'}
                style={styles.toggle}>
                <Text style={styles.toggleText}>
                  {showDetails ? 'Hide raw response ▲' : 'Show raw response ▼'}
                </Text>
              </Pressable>

              {showDetails && (
                <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={styles.details}>
                  <Text style={styles.resultLabel}>session_token</Text>
                  <Text selectable style={styles.resultText}>
                    {result.sessionToken}
                  </Text>
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

      <Modal
        visible={pendingSession !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingSession(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Signed in</Text>
            <Text style={styles.modalMessage}>Sandbox session created successfully.</Text>
            <Pressable
              onPress={() => {
                const session = pendingSession;
                setPendingSession(null);
                if (session) {
                  beginSetup(session);
                  router.push('/health-profile-setup');
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Continue to Home"
              style={[styles.button, styles.modalButton]}>
              <Text style={styles.buttonText}>Continue to Home</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AuthColors.background },
  safeArea: { flex: 1 },
  content: { padding: 24, gap: 16 },
  title: { color: AuthColors.text, fontSize: 22, fontWeight: '700' },
  subtitle: { color: AuthColors.textSecondary, fontSize: 13, lineHeight: 18 },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AuthColors.border,
    backgroundColor: AuthColors.surface,
    color: AuthColors.text,
    paddingHorizontal: 14,
    fontFamily: 'monospace',
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: AuthColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  useButton: { marginTop: 0 },
  buttonText: { color: AuthColors.onPrimary, fontSize: 15, fontWeight: '600' },
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
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    gap: 12,
    backgroundColor: AuthColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AuthColors.border,
    padding: 20,
  },
  modalTitle: { color: AuthColors.text, fontSize: 18, fontWeight: '700' },
  modalMessage: { color: AuthColors.textSecondary, fontSize: 14, lineHeight: 20 },
  modalButton: { marginTop: 4 },
});
