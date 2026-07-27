import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RetryErrorCard } from "@/components/health-profile/retry-error-card";
import { AuthColors } from "@/constants/auth-theme";
import {
  BottomTabInset,
  Colors,
  Fonts,
  MaxContentWidth,
  Spacing,
} from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import {
  createOrGetHealthProfile,
  type HealthProfile,
} from "@/lib/health-profile";
import {
  clearHealthProfile,
  loadHealthProfile,
  saveHealthProfile,
} from "@/lib/health-profile-storage";

// Dev-only debug panel below reuses the app-shell's own theme tokens — it's
// not part of the citizen-facing identity flow, which uses AuthColors
// throughout to stay visually consistent with the login/setup screens.
const light = Colors.light;

type ServiceTileDef = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  subtitle: string;
};

const SERVICE_TILES: ServiceTileDef[] = [
  {
    key: "find-care",
    label: "Find Care",
    icon: "medical-outline",
    subtitle: "Search doctors, clinics, and specialists near you.",
  },
  {
    key: "facilities",
    label: "Facilities",
    icon: "business-outline",
    subtitle: "Browse hospitals and health centers.",
  },
  {
    key: "appointments",
    label: "Appointments",
    icon: "calendar-outline",
    subtitle: "Book and manage your appointments.",
  },
  {
    key: "health-id",
    label: "Health ID",
    icon: "id-card-outline",
    subtitle: "View your Digital Health ID and QR code.",
  },
  {
    key: "nearby",
    label: "Nearby",
    icon: "location-outline",
    subtitle: "Find healthcare services close to you.",
  },
  {
    key: "journey",
    label: "Journey",
    icon: "map-outline",
    subtitle: "Track your healthcare journey and history.",
  },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning,";
  if (hour < 18) return "Good Afternoon,";
  return "Good Evening,";
}

function getInitials(fullName: string | null): string {
  if (!fullName) return "AC";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function handleServicePress(tile: ServiceTileDef) {
  if (tile.key === "health-id") {
    router.push("/health-id");
    return;
  }
  if (tile.key === "journey") {
    router.push("/journey");
    return;
  }
  if (tile.key === 'journey') {
    router.push('/journey');
    return;
  }
  router.push({
    pathname: "/coming-soon",
    params: { title: tile.label, subtitle: tile.subtitle, icon: tile.icon },
  });
}

function openAiAssistant() {
  router.push("/health-navigation");
}

function HomeHeader({ fullName }: { fullName: string | null }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.greeting}>{getGreeting()}</Text>
        <Text style={styles.greetingName} numberOfLines={1}>
          {fullName ?? "AGAPAY Citizen"}
        </Text>
      </View>
      <View style={styles.headerActions}>
        <Pressable
          onPress={() => router.push("/alerts")}
          accessibilityRole="button"
          accessibilityLabel="View alerts"
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="notifications-outline"
            size={20}
            color={AuthColors.text}
          />
          <View style={styles.badgeDot} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/profile")}
          accessibilityRole="button"
          accessibilityLabel="View profile"
          style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
        >
          <Text style={styles.avatarText}>{getInitials(fullName)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function HealthIdSummaryCard({ profile }: { profile: HealthProfile }) {
  return (
    <View style={styles.idCard}>
      <View style={styles.idCardMain}>
        <Text style={styles.idCardLabel}>DIGITAL HEALTH ID</Text>
        <Text
          style={styles.idCardName}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {profile.full_name ?? "AGAPAY Citizen"}
        </Text>
        <View style={styles.idCardNumberBlock}>
          <Text style={styles.idCardSubLabel}>ID Number</Text>
          <Text selectable style={styles.idCardNumber}>
            {profile.health_id}
          </Text>
        </View>
      </View>
      <View style={styles.idCardSide}>
        <View style={styles.verifiedBadge}>
          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
          <Text style={styles.verifiedText}>Verified</Text>
        </View>
        <View style={styles.qrBadge}>
          <Text style={styles.qrBadgeText}>QR Available</Text>
        </View>
        <Pressable
          onPress={() => router.push("/health-id")}
          accessibilityRole="button"
          accessibilityLabel="View your full Digital Health ID and QR code"
          style={({ pressed }) => [
            styles.viewIdButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.viewIdButtonText}>View ID</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { session, signOut } = useAuth();
  const [healthProfile, setHealthProfile] = useState<HealthProfile | null>(
    null,
  );
  const [backfillError, setBackfillError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadOrBackfill() {
      setIsLoading(true);
      setBackfillError(null);

      const stored = await loadHealthProfile();
      if (stored) {
        if (!cancelled) {
          setHealthProfile(stored);
          setIsLoading(false);
        }
        return;
      }

      // No profile in local storage yet — this only happens for a session
      // that predates this feature (e.g. signed in before an app update).
      // The citizen profile from eGov SSO is already on the auth session, so
      // just create/reuse the health profile from it, same as the fresh-login flow.
      const citizenProfile = session?.profile;
      if (!citizenProfile) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      const healthResult = await createOrGetHealthProfile(citizenProfile);
      if (cancelled) return;
      if (!healthResult.ok) {
        setBackfillError(
          "We couldn't set up your AGAPAY profile right now. Please try again.",
        );
        setIsLoading(false);
        return;
      }

      await saveHealthProfile(healthResult.data);
      if (!cancelled) {
        setHealthProfile(healthResult.data);
        setIsLoading(false);
      }
    }

    loadOrBackfill();
    return () => {
      cancelled = true;
    };
  }, [session?.profile, attempt]);

  return (
    <View
      style={[styles.container, { backgroundColor: AuthColors.background }]}
    >
      <SafeAreaView style={styles.safeArea}>
        {healthProfile ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <HomeHeader fullName={healthProfile.full_name} />
            <HealthIdSummaryCard profile={healthProfile} />

            <View style={styles.servicesSection}>
              <Text style={styles.sectionTitle}>Main Services</Text>
              <View style={styles.servicesGrid}>
                {SERVICE_TILES.map((tile) => (
                  <Pressable
                    key={tile.key}
                    onPress={() => handleServicePress(tile)}
                    accessibilityRole="button"
                    accessibilityLabel={tile.label}
                    style={({ pressed }) => [
                      styles.serviceTile,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name={tile.icon}
                      size={26}
                      color={AuthColors.primary}
                    />
                    <Text style={styles.serviceTileLabel}>{tile.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable
              onPress={openAiAssistant}
              accessibilityRole="button"
              accessibilityLabel="Open AI Health Assistant"
              style={({ pressed }) => [
                styles.aiBanner,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.aiIconCircle}>
                <Ionicons name="help-circle" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.aiTextBlock}>
                <Text style={styles.aiTitle}>AI Health Assistant</Text>
                <Text style={styles.aiSubtitle}>
                  How can we help you today?
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={AuthColors.textSecondary}
              />
            </Pressable>

            {__DEV__ && (
              <View
                style={[
                  styles.stepContainer,
                  { backgroundColor: light.backgroundElement },
                ]}
              >
                <View style={styles.authRow}>
                  <Text style={[styles.authLabel, { color: light.text }]}>
                    Auth
                  </Text>
                  <View
                    style={[
                      styles.signOutChip,
                      { backgroundColor: light.backgroundSelected },
                    ]}
                  >
                    <Pressable
                      onPress={() => {
                        clearHealthProfile();
                        signOut();
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Sign out and return to the login screen"
                    >
                      <Text
                        style={[
                          styles.signOutText,
                          { color: light.textSecondary },
                        ]}
                      >
                        sign out
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        ) : backfillError ? (
          <View style={styles.cardSection}>
            <RetryErrorCard
              message={backfillError}
              onRetry={() => setAttempt((n) => n + 1)}
              retryAccessibilityLabel="Retry loading your AGAPAY profile"
            />
          </View>
        ) : isLoading ? (
          <View style={styles.loadingSection}>
            <ActivityIndicator color={AuthColors.primary} size="large" />
            <Text style={styles.loadingText} accessibilityLiveRegion="polite">
              Loading your AGAPAY profile…
            </Text>
          </View>
        ) : (
          <View style={styles.heroSection}>
            <Text style={[styles.title, { color: AuthColors.text }]}>
              Welcome to AGAPAY
            </Text>
            <Text
              style={[styles.subtitle, { color: AuthColors.textSecondary }]}
            >
              Your Digital Health Profile is coming soon.
            </Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    flexDirection: "row",
  },
  safeArea: {
    flex: 1,
    alignItems: "center",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  scroll: {
    flex: 1,
    alignSelf: "stretch",
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  loadingSection: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: Spacing.three,
  },
  loadingText: {
    color: AuthColors.textSecondary,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  heroSection: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  cardSection: {
    flex: 1,
    justifyContent: "center",
    alignSelf: "stretch",
    paddingHorizontal: Spacing.two,
  },
  title: {
    fontSize: 48,
    fontWeight: "600",
    lineHeight: 52,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 32,
    fontWeight: "600",
    lineHeight: 44,
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.three,
  },
  headerText: {
    flexShrink: 1,
    marginRight: Spacing.three,
  },
  greeting: {
    color: AuthColors.textSecondary,
    fontSize: 13,
  },
  greetingName: {
    color: AuthColors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AuthColors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDot: {
    position: "absolute",
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AuthColors.danger,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AuthColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.7,
  },
  idCard: {
    flexDirection: "row",
    backgroundColor: AuthColors.primary,
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  idCardMain: {
    flex: 1,
    gap: Spacing.half,
  },
  idCardLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  idCardName: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "700",
  },
  idCardNumberBlock: {
    marginTop: Spacing.three,
    gap: 2,
  },
  idCardSubLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
  },
  idCardNumber: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "monospace",
    letterSpacing: 0.5,
  },
  idCardSide: {
    alignItems: "flex-end",
    gap: Spacing.two,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: AuthColors.success,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
  verifiedText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  qrBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
  qrBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  viewIdButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    marginTop: Spacing.one,
  },
  viewIdButtonText: {
    color: AuthColors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  servicesSection: {
    gap: Spacing.three,
  },
  sectionTitle: {
    color: AuthColors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  servicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.three,
  },
  serviceTile: {
    flexBasis: "30%",
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    backgroundColor: AuthColors.surface,
    borderRadius: 16,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.one,
  },
  serviceTileLabel: {
    color: AuthColors.text,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  aiBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    padding: Spacing.three,
  },
  aiIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AuthColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  aiTextBlock: {
    flex: 1,
    gap: 2,
  },
  aiTitle: {
    color: AuthColors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  aiSubtitle: {
    color: AuthColors.textSecondary,
    fontSize: 13,
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: "stretch",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
  authRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  authLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  signOutChip: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
  signOutText: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: "700" as const }) ?? "500",
    fontSize: 12,
  },
});
