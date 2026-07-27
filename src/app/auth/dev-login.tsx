import { useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthColors } from '@/constants/auth-theme';
import { getEgovLivenessRedirectUri } from '@/constants/egov-sso';
import { useAuth } from '@/contexts/auth-context';
import { getVerificationStatus, startVerification } from '@/lib/egov-sso-client';

type RunState =
  | { status: 'idle' }
  | { status: 'starting' }
  | { status: 'awaiting_liveness'; flowId: string; profile: unknown; livenessUrl: string }
  | { status: 'checking'; flowId: string; profile: unknown; livenessUrl: string }
  | { status: 'completed'; profile: unknown; everify: unknown }
  | { status: 'error'; message: string };

/**
 * Dev-only sandbox tester: lets a tester paste a manually-obtained eGov
 * sandbox exchange_code and run the full SSO + Face Liveness + eVerify
 * orchestration flow without going through the real WebBrowser SSO redirect.
 */
export default function DevLoginScreen() {
  const { signIn } = useAuth();
  const [code, setCode] = useState('');
  const [sessionIdInput, setSessionIdInput] = useState('');
  const [result, setResult] = useState<RunState>({ status: 'idle' });
  const [showDetails, setShowDetails] = useState(false);
  const [pendingSession, setPendingSession] = useState<{ profile: unknown; everify: unknown } | null>(null);

  // Hooks above run unconditionally; nothing below executes in production.
  if (!__DEV__) {
    return null;
  }

  const start = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setShowDetails(false);
    setResult({ status: 'starting' });

    const startResult = await startVerification(trimmed, getEgovLivenessRedirectUri());
    if (!startResult.ok) {
      setResult({ status: 'error', message: `Start failed: ${JSON.stringify(startResult)}` });
      return;
    }

    setResult({
      status: 'awaiting_liveness',
      flowId: startResult.data.flowId,
      profile: startResult.data.profile,
      livenessUrl: startResult.data.liveness.url,
    });
  };

  const checkStatus = async (flowId: string, profile: unknown, livenessUrl: string) => {
    const trimmedSessionId = sessionIdInput.trim();
    if (!trimmedSessionId) {
      setResult({ status: 'error', message: 'Paste the session_id from the liveness page redirect URL first.' });
      return;
    }

    setResult({ status: 'checking', flowId, profile, livenessUrl });

    const statusResult = await getVerificationStatus(flowId, trimmedSessionId);
    if (!statusResult.ok) {
      setResult({ status: 'error', message: `Status check failed: ${JSON.stringify(statusResult)}` });
      return;
    }

    setResult({ status: 'completed', profile, everify: statusResult.data.everify });
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Dev: Sandbox eGov SSO + Liveness + eVerify</Text>
          <Text style={styles.subtitle}>
            Paste a sandbox exchange_code from the eGov test portal to run the full verification chain. This
            screen is excluded from production builds.
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
            disabled={result.status === 'starting' || result.status === 'checking'}
            accessibilityRole="button"
            accessibilityLabel="Start verification"
            style={styles.button}>
            {result.status === 'starting' ? (
              <ActivityIndicator color={AuthColors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Start verification</Text>
            )}
          </Pressable>

          {result.status === 'error' && (
            <Animated.View entering={FadeIn.duration(200)}>
              <Text style={styles.error}>{result.message}</Text>
            </Animated.View>
          )}

          {(result.status === 'awaiting_liveness' || result.status === 'checking') && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.resultBlock}>
              <Text style={styles.successText}>✓ Verification started — flow_id: {result.flowId}</Text>

              <Pressable
                onPress={() => Linking.openURL(result.livenessUrl)}
                accessibilityRole="button"
                accessibilityLabel="Open face liveness verification"
                style={[styles.button, styles.useButton]}>
                <Text style={styles.buttonText}>Open Face Verification</Text>
              </Pressable>

              <TextInput
                value={sessionIdInput}
                onChangeText={setSessionIdInput}
                placeholder="session_id from the redirect URL"
                placeholderTextColor={AuthColors.textSecondary}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Liveness session_id input"
              />

              <Pressable
                onPress={() => checkStatus(result.flowId, result.profile, result.livenessUrl)}
                disabled={result.status === 'checking'}
                accessibilityRole="button"
                accessibilityLabel="Check verification status"
                style={[styles.button, styles.useButton]}>
                {result.status === 'checking' ? (
                  <ActivityIndicator color={AuthColors.onPrimary} />
                ) : (
                  <Text style={styles.buttonText}>Check status</Text>
                )}
              </Pressable>
            </Animated.View>
          )}

          {result.status === 'completed' && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.resultBlock}>
              <Text style={styles.successText}>✓ eVerify completed</Text>

              <Pressable
                onPress={() => setPendingSession({ profile: result.profile, everify: result.everify })}
                accessibilityRole="button"
                accessibilityLabel="Use this identity and continue into the app"
                style={[styles.button, styles.useButton]}>
                <Text style={styles.buttonText}>Use this identity &amp; continue</Text>
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
                  <Text style={styles.resultLabel}>profile</Text>
                  <Text selectable style={styles.resultText}>
                    {JSON.stringify(result.profile, null, 2)}
                  </Text>
                  <Text style={styles.resultLabel}>everify</Text>
                  <Text selectable style={styles.resultText}>
                    {JSON.stringify(result.everify, null, 2)}
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
            <Text style={styles.modalMessage}>Sandbox identity verified successfully.</Text>
            <Pressable
              onPress={() => {
                const session = pendingSession;
                setPendingSession(null);
                if (session) signIn(session);
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
