import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthColors } from '@/constants/auth-theme';
import { Spacing } from '@/constants/theme';

const QUICK_SELECT_TAGS = ['Fever', 'Cough', 'Child Consultation', 'Injury', 'Check-up'] as const;

export default function HealthNavigationScreen() {
  const [concern, setConcern] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // "Ask Again" (on the result screen) returns here via router.back(), so
  // reset on every focus rather than trying to thread a "clear" param
  // through the stack.
  useFocusEffect(
    useCallback(() => {
      setConcern('');
      setSelectedTag(null);
    }, []),
  );

  function handleChipPress(tag: string) {
    if (selectedTag === tag) {
      setSelectedTag(null);
      setConcern('');
    } else {
      setSelectedTag(tag);
      setConcern(tag);
    }
  }

  function handleConcernChange(text: string) {
    setConcern(text);
    setSelectedTag(null);
  }

  function handleGetRecommendation() {
    const trimmed = concern.trim();
    if (trimmed.length === 0) return;
    router.push({ pathname: '/health-navigation/result', params: { concern: trimmed } });
  }

  const canSubmit = concern.trim().length > 0;

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
          <Text style={styles.headerTitle}>AI Health Navigation</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.iconCircle}>
            <Ionicons name="happy-outline" size={40} color={AuthColors.primary} />
          </View>
          <Text style={styles.title}>How can we help today?</Text>
          <Text style={styles.subtitle}>Tell us what you need and we&apos;ll guide you to the right healthcare service.</Text>

          <View style={styles.inputRow}>
            <TextInput
              value={concern}
              onChangeText={handleConcernChange}
              placeholder="Describe your concern..."
              placeholderTextColor={AuthColors.textSecondary}
              style={styles.input}
              multiline
            />
            <Ionicons name="mic-outline" size={20} color={AuthColors.primary} />
          </View>

          <View style={styles.chipsRow}>
            {QUICK_SELECT_TAGS.map((tag) => {
              const selected = selectedTag === tag;
              return (
                <Pressable
                  key={tag}
                  onPress={() => handleChipPress(tag)}
                  accessibilityRole="button"
                  accessibilityLabel={tag}
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{tag}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={handleGetRecommendation}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="Get recommendation"
            style={({ pressed }) => [
              styles.submitButton,
              !canSubmit && styles.submitButtonDisabled,
              pressed && canSubmit && styles.pressed,
            ]}>
            <Text style={styles.submitButtonText}>Get Recommendation</Text>
            <Ionicons name="arrow-forward" size={18} color={AuthColors.onPrimary} />
          </Pressable>
        </ScrollView>
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
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  backButton: {
    padding: Spacing.one,
  },
  headerSpacer: {
    width: 22 + Spacing.one * 2,
  },
  pressed: {
    opacity: 0.7,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: AuthColors.text,
    textAlign: 'center',
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: AuthColors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: AuthColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.two,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: Spacing.two,
    backgroundColor: AuthColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AuthColors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  input: {
    flex: 1,
    color: AuthColors.text,
    fontSize: 15,
    maxHeight: 100,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    alignSelf: 'stretch',
  },
  chip: {
    borderWidth: 1,
    borderColor: AuthColors.border,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: AuthColors.surface,
  },
  chipSelected: {
    backgroundColor: AuthColors.primary,
    borderColor: AuthColors.primary,
  },
  chipText: {
    color: AuthColors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: AuthColors.onPrimary,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    alignSelf: 'stretch',
    backgroundColor: AuthColors.primary,
    borderRadius: 999,
    paddingVertical: Spacing.three,
    marginTop: Spacing.three,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: AuthColors.onPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});
