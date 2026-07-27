import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset, Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

const light = Colors.light;

export default function HomeScreen() {
  const { signOut } = useAuth();

  return (
    <View style={[styles.container, { backgroundColor: light.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.heroSection}>
          <Text style={[styles.title, { color: light.text }]}>Welcome to AGAPAY</Text>
          <Text style={[styles.subtitle, { color: light.textSecondary }]}>
            Your Digital Health Profile is coming soon.
          </Text>
        </View>

        {__DEV__ && (
          <View style={[styles.stepContainer, { backgroundColor: light.backgroundElement }]}>
            <View style={styles.authRow}>
              <Text style={[styles.authLabel, { color: light.text }]}>Auth</Text>
              <View style={[styles.signOutChip, { backgroundColor: light.backgroundSelected }]}>
                <Pressable
                  onPress={() => signOut()}
                  accessibilityRole="button"
                  accessibilityLabel="Sign out and return to the login screen">
                  <Text style={[styles.signOutText, { color: light.textSecondary }]}>sign out</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    fontSize: 48,
    fontWeight: '600',
    lineHeight: 52,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 32,
    fontWeight: '600',
    lineHeight: 44,
    textAlign: 'center',
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
  authRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  authLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  signOutChip: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
  signOutText: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: '700' as const }) ?? '500',
    fontSize: 12,
  },
});
