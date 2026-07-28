import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthColors } from '@/constants/auth-theme';

export function RetryErrorCard({
  message,
  onRetry,
  retryAccessibilityLabel,
  retryLabel = 'Try again',
}: {
  message: string;
  onRetry: () => void;
  retryAccessibilityLabel: string;
  retryLabel?: string;
}) {
  return (
    <View style={styles.card} accessibilityRole="alert">
      <Text style={styles.message}>{message}</Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={retryAccessibilityLabel}
        style={styles.button}>
        <Text style={styles.buttonText}>{retryLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: 16,
    backgroundColor: AuthColors.dangerBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AuthColors.danger,
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  message: { color: AuthColors.danger, fontSize: 14, textAlign: 'center', lineHeight: 20, fontWeight: '600' },
  button: {
    minHeight: 48,
    minWidth: 160,
    borderRadius: 12,
    backgroundColor: AuthColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonText: { color: AuthColors.onPrimary, fontSize: 15, fontWeight: '600' },
});
