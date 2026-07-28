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

import { BottomTabInset, Brand, Spacing } from '@/constants/theme';
import { useEmergencyDetection } from '@/hooks/use-emergency-detection';
import { useTheme } from '@/hooks/use-theme';
import type { Recommendation } from '@/lib/ai/recommendation';
import { EmergencyModal, RecommendationCard } from '@/components/recommendation-card';

type FlowState = 'idle' | 'loading' | 'results' | 'error';

export default function NavigateScreen() {
  const theme = useTheme();
  const [description, setDescription] = useState('');
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const emergency = useEmergencyDetection();

  const doSubmit = useCallback(async (text: string) => {
    Keyboard.dismiss();
    setFlowState('loading');
    setError(null);
    setRecommendations([]);

    try {
      const response = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: text }),
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
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = description.trim();
    if (!trimmed) return;

    if (emergency.check(trimmed)) return;

    doSubmit(trimmed);
  }, [description, emergency, doSubmit]);

  const handleEmergencyContinue = useCallback(() => {
    emergency.dismiss();
    doSubmit(description.trim());
  }, [emergency, description, doSubmit]);

  const handleActionPress = useCallback((rec: Recommendation) => {
    if (rec.action === 'find_facilities') {
      router.push('/explore');
    } else if (rec.action === 'book_now') {
      router.push('/explore');
    }
  }, []);

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
            <Text style={styles.greeting}>Hi there 👋</Text>
            <Text style={[styles.title, { color: theme.text }]}>How can we help you today?</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Describe your symptoms, concern, or the type of care you think you need.
            </Text>
          </View>

          <View style={styles.inputCard}>
            <TextInput
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                if (text.trim().length === 0) emergency.reset();
              }}
              placeholder="e.g., I have a fever and sore throat..."
              placeholderTextColor={Brand.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={styles.input}
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
              <ActivityIndicator size="large" color={Brand.primary} />
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
                <RecommendationCard
                  key={`${rec.service}-${index}`}
                  recommendation={rec}
                  onActionPress={handleActionPress}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <EmergencyModal
        visible={emergency.showEmergencyModal}
        onDismiss={emergency.dismiss}
        onContinue={handleEmergencyContinue}
      />
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
  greeting: {
    fontSize: 15,
    fontWeight: '500',
    color: Brand.textSecondary,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
    color: Brand.textPrimary,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  inputCard: {
    backgroundColor: Brand.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    minHeight: 120,
    fontSize: 16,
    lineHeight: 24,
    color: Brand.textPrimary,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: Brand.primary,
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
    backgroundColor: Brand.dangerBg,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  errorText: {
    color: Brand.danger,
    fontSize: 14,
  },
  retryButton: {
    alignSelf: 'flex-start',
  },
  retryText: {
    color: Brand.danger,
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
});
