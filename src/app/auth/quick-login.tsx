import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthColors } from '@/constants/auth-theme';
import { useHealthProfileSetup } from '@/contexts/health-profile-setup-context';
import { quickLogin } from '@/lib/egov-sso-client';

type RunState = { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string };

/**
 * Dev-only shortcut: paste a manually-obtained eGov sandbox exchange_code
 * and go straight to the citizen dashboard, skipping Face Liveness/eVerify.
 * Separate route from the production /auth screen and from dev-login.tsx's
 * full-chain tester, so neither is affected by this.
 */
export default function QuickLoginScreen() {
  const { beginSetup } = useHealthProfileSetup();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<RunState>({ status: 'idle' });

  // Hooks above run unconditionally; nothing below executes in production.
  if (!__DEV__) {
    return null;
  }

  const submit = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setResult({ status: 'loading' });

    const loginResult = await quickLogin(trimmed);
    if (!loginResult.ok) {
      setResult({ status: 'error', message: `Quick login failed: ${JSON.stringify(loginResult)}` });
      return;
    }

    beginSetup({ profile: loginResult.data.profile, everify: null });
    router.push('/health-profile-setup');
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Dev: Quick SSO Login</Text>
          <Text style={styles.subtitle}>
            Paste a sandbox exchange_code to skip straight to the citizen dashboard. Bypasses Face
            Liveness/eVerify — use this to test the dashboard, not the identity-verification flow.
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
            onPress={submit}
            disabled={result.status === 'loading'}
            accessibilityRole="button"
            accessibilityLabel="Quick login"
            style={styles.button}>
            {result.status === 'loading' ? (
              <ActivityIndicator color={AuthColors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Continue to dashboard</Text>
            )}
          </Pressable>

          {result.status === 'error' && (
            <Animated.View entering={FadeIn.duration(200)}>
              <Text style={styles.error}>{result.message}</Text>
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
  buttonText: { color: AuthColors.onPrimary, fontSize: 15, fontWeight: '600' },
  error: { color: AuthColors.danger, fontSize: 13 },
});
