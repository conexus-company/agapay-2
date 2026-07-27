import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset, Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const light = Colors.light;

type Recommendation = {
  service: string;
  reason: string;
  action: string;
};

type FlowState = 'idle' | 'loading' | 'results' | 'error';

export default function NavigateScreen() {
  const theme = useTheme();
  const [description, setDescription] = useState('');
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    const trimmed = description.trim();
    if (!trimmed) return;

    Keyboard.dismiss();
    setFlowState('loading');
    setError(null);
    setRecommendations([]);

    try {
      const response = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: trimmed }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? 'Failed to get recommendations');
        setFlowState('error');
        return;
      }

      const body = await response.json();
      setRecommendations(body.recommendations ?? []);
      setFlowState('results');
    } catch {
      setError('Network error — check your connection');
      setFlowState('error');
    }
  }, [description]);

  const isBusy = flowState === 'loading';
  const canSubmit = description.trim().length > 0 && !isBusy;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>What do you need help with?</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Describe your symptoms, concern, or the type of care you think you need.
            </Text>
          </View>

          <View style={styles.inputSection}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="e.g., I have a fever and sore throat..."
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={[styles.input, { color: theme.text, borderColor: '#E2E6EC', backgroundColor: '#FFFFFF' }]}
              accessibilityLabel="Describe your health concern"
              returnKeyType="go"
              onSubmitEditing={canSubmit ? handleSubmit : undefined}
            />
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.submitPressed,
              !canSubmit && styles.submitDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Find care options"
            accessibilityState={{ disabled: !canSubmit, busy: isBusy }}>
            {isBusy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Find Care Options</Text>
            )}
          </Pressable>

          {flowState === 'loading' && (
            <View style={styles.loadingSection}>
              <ActivityIndicator size="large" color={light.text} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                Analyzing your request...
              </Text>
            </View>
          )}

          {flowState === 'error' && error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={handleSubmit} style={styles.retryButton}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          )}

          {flowState === 'results' && recommendations.length > 0 && (
            <View style={styles.resultsSection}>
              <Text style={[styles.resultsLabel, { color: theme.textSecondary }]}>
                Recommended services
              </Text>
              {recommendations.map((rec, index) => (
                <View key={`${rec.service}-${index}`} style={[styles.card, { borderColor: '#E2E6EC' }]}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>{rec.service}</Text>
                  <Text style={[styles.cardReason, { color: theme.textSecondary }]}>{rec.reason}</Text>
                  <Pressable
                    onPress={() => router.push('/explore')}
                    style={({ pressed }) => [
                      styles.cardButton,
                      pressed && { opacity: 0.7 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Find facilities for ${rec.service}`}>
                    <Text style={styles.cardButtonText}>Find Facilities</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
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
    gap: Spacing.three,
  },
  header: {
    paddingTop: Spacing.four,
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
  inputSection: {
    gap: Spacing.two,
  },
  input: {
    minHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 16,
    lineHeight: 24,
  },
  submitButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  submitPressed: {
    opacity: 0.85,
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingSection: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  loadingText: {
    fontSize: 15,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    gap: Spacing.two,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  retryButton: {
    alignSelf: 'flex-start',
  },
  retryText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  resultsSection: {
    gap: Spacing.two,
  },
  resultsLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.one,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
  },
  cardReason: {
    fontSize: 14,
    lineHeight: 20,
  },
  cardButton: {
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: '#F0F0F3',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: Spacing.one,
  },
  cardButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
});
