import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDigitalHealthId } from '@/hooks/use-digital-health-id';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function PostVerifyScreen() {
  const theme = useTheme();
  const { id, loading } = useDigitalHealthId();

  useEffect(() => {
    if (loading) return;
    router.replace('/(app)/identity');
  }, [loading, id]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Verification Successful</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Your identity has been verified. Setting up your Digital Health ID…
          </Text>
          <ActivityIndicator size="large" color={theme.text} style={styles.spinner} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 32,
    fontWeight: '700',
    color: '#059669',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  spinner: {
    marginTop: Spacing.three,
  },
});
