import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  BottomTabInset,
  Brand,
  MaxContentWidth,
  Spacing,
} from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";

export default function HomeScreen() {
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          bounces={false}
        >
          <View style={styles.heroSection}>
            <View style={styles.logoMark}>
              <Text style={styles.logoIcon}>💙</Text>
            </View>
            <Text style={styles.title}>AGAPAY</Text>
            <Text style={styles.tagline}>
              Your Digital Healthcare Journey, Connected Once.
            </Text>
          </View>

          <View style={styles.pillarsRow}>
            <View style={styles.pillar}>
              <Text style={styles.pillarIcon}>🛡️</Text>
              <Text style={styles.pillarLabel}>Verify Once</Text>
            </View>
            <View style={styles.pillar}>
              <Text style={styles.pillarIcon}>🔍</Text>
              <Text style={styles.pillarLabel}>Find Care</Text>
            </View>
            <View style={styles.pillar}>
              <Text style={styles.pillarIcon}>📋</Text>
              <Text style={styles.pillarLabel}>Your Journey</Text>
            </View>
            <View style={styles.pillar}>
              <Text style={styles.pillarIcon}>💬</Text>
              <Text style={styles.pillarLabel}>Stay Connected</Text>
            </View>
          </View>

          <View style={styles.actionsCard}>
            <Text style={styles.actionsTitle}>Get Started</Text>

            <Pressable
              onPress={() => router.push("/navigate")}
              style={({ pressed }) => [
                styles.actionBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.actionBtnText}>Find Care</Text>
              <Text style={styles.actionBtnSub}>
                Describe your symptoms, get AI guidance
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push("/explore")}
              style={({ pressed }) => [
                styles.actionBtnOutline,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.actionBtnOutlineText}>
                Explore Facilities
              </Text>
              <Text style={styles.actionBtnSub}>
                View nearby hospitals and clinics
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push("/appointment")}
              style={({ pressed }) => [
                styles.actionBtnOutline,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.actionBtnOutlineText}>My Appointments</Text>
              <Text style={styles.actionBtnSub}>View and manage bookings</Text>
            </Pressable>
          </View>

          {__DEV__ && (
            <View style={styles.devSection}>
              <View style={styles.authRow}>
                <Text style={styles.authLabel}>Auth</Text>
                <Pressable
                  onPress={() => signOut()}
                  style={styles.signOutChip}
                  accessibilityRole="button"
                  accessibilityLabel="Sign out and return to the login screen"
                >
                  <Text style={styles.signOutText}>sign out</Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.background,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
    alignItems: "center",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  heroSection: {
    alignItems: "center",
    paddingTop: Spacing.six,
    gap: Spacing.two,
  },
  logoMark: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Brand.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoIcon: {
    fontSize: 36,
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: Brand.primary,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 16,
    color: Brand.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: Spacing.four,
  },
  pillarsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: Spacing.two,
  },
  pillar: {
    alignItems: "center",
    gap: Spacing.one,
  },
  pillarIcon: {
    fontSize: 24,
  },
  pillarLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Brand.textSecondary,
    textAlign: "center",
  },
  actionsCard: {
    width: "100%",
    backgroundColor: Brand.surface,
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.three,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Brand.textPrimary,
  },
  actionBtn: {
    backgroundColor: Brand.primary,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  actionBtnOutline: {
    backgroundColor: "transparent",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Brand.border,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  actionBtnOutlineText: {
    color: Brand.primary,
    fontSize: 16,
    fontWeight: "600",
  },
  actionBtnSub: {
    fontSize: 13,
    color: Brand.textSecondary,
  },
  devSection: {
    width: "100%",
    backgroundColor: Brand.surface,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  authRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  authLabel: {
    fontSize: 14,
    color: Brand.textPrimary,
    fontWeight: "500",
  },
  signOutChip: {
    borderRadius: 8,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    backgroundColor: Brand.mutedBg,
  },
  signOutText: {
    fontSize: 12,
    fontWeight: "500",
    color: Brand.muted,
  },
});
