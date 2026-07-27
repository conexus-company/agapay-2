import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthColors } from "@/constants/auth-theme";
import {
  EGOV_SSO_AUTHORIZE_URL,
  getEgovLivenessRedirectUri,
  getEgovSsoRedirectUri,
} from "@/constants/egov-sso";
import { useHealthProfileSetup } from "@/contexts/health-profile-setup-context";
import type { ApiResult } from "@/lib/api-result";
import {
  getVerificationStatus,
  startVerification,
} from "@/lib/egov-sso-client";

WebBrowser.maybeCompleteAuthSession();

type FlowState = "idle" | "authorizing" | "starting" | "success" | "error";

function describeFailure(result: ApiResult<unknown>): string {
  if (result.ok) {
    return "Something went wrong. Please try again.";
  }

  if (result.kind === "network_error") {
    return "We couldn't reach the eGov SSO service. Check your connection and try again.";
  }

  if (result.kind === "upstream_error") {
    if (result.status === 422) {
      return "This sign-in link has expired or was already used. Please start again.";
    }
    if (result.status === 403) {
      return "We couldn't verify your eGov SSO credentials. Please try again.";
    }
    return "Something went wrong on our end. Please try again in a moment.";
  }

  return "Something went wrong. Please try again.";
}

export default function LoginScreen() {
  const { beginSetup } = useHealthProfileSetup();
  const [state, setState] = useState<FlowState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ctaScale = useSharedValue(1);
  const ctaAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  const checkStatus = useCallback(
    async (flowId: string, sessionIdForCheck: string, profile: unknown) => {
      console.log("[login] checking verification status…");
      setState("checking");

      const statusResult = await getVerificationStatus(
        flowId,
        sessionIdForCheck,
      );
      console.log("[login] status result:", JSON.stringify(statusResult));

      if (!statusResult.ok) {
        // A failed status check (often a transient sandbox network blip) does
        // NOT invalidate the flow_id/session_id — stay on the verify step so
        // the citizen can just retry, instead of forcing a full restart that
        // would burn another single-use SSO exchange code.
        setStatusError(describeFailure("status", statusResult));
        setState("verifying");
        return;
      }

      setStatusError(null);
      console.log("[login] verification completed — signing in");
      setState("success");
      setTimeout(() => {
        beginSetup({ profile, everify: statusResult.data.everify });
        router.push("/health-profile-setup");
      }, 700);
    },
    [beginSetup],
  );

  const runLogin = useCallback(async () => {
    setErrorMessage(null);
    setState("authorizing");

    const redirectUri = getEgovSsoRedirectUri();

    const authResult = await WebBrowser.openAuthSessionAsync(
      EGOV_SSO_AUTHORIZE_URL,
      redirectUri,
    ).catch(() => null);

    if (!authResult || authResult.type !== "success") {
      setState("idle");
      return;
    }

    const exchangeCode = Linking.parse(authResult.url).queryParams
      ?.exchange_code;
    if (typeof exchangeCode !== "string" || exchangeCode.length === 0) {
      setErrorMessage(
        "We did not receive a valid sign-in code. Please try again.",
      );
      setState("error");
      return;
    }

    setState("starting");

    const startResult = await startVerification(
      exchangeCode,
      getEgovLivenessRedirectUri(),
    );
    if (!startResult.ok) {
      setErrorMessage(describeFailure(startResult));
      setState("error");
      return;
    }

    setVerification(startResult.data);
    setState("verifying");
  }, []);

  const openLivenessCheck = useCallback(async () => {
    if (!verification) return;
    console.log("[login] opening face verification browser…");
    // Mirrors the SSO step: openAuthSessionAsync auto-dismisses the browser
    // and returns control to the app as soon as the hosted liveness SDK page
    // redirects to our callback_url with the completed session_id.
    const result = await WebBrowser.openAuthSessionAsync(
      verification.liveness.url,
      getEgovLivenessRedirectUri(),
    ).catch((error) => {
      console.error("[login] openAuthSessionAsync threw:", error);
      return null;
    });
    console.log(
      "[login] face verification browser closed, result type:",
      result?.type,
    );

    if (!result || result.type !== "success") {
      return;
    }

    const params = Linking.parse(result.url).queryParams;
    const newSessionId = params?.session_id;

    if (typeof newSessionId !== "string" || newSessionId.length === 0) {
      setStatusError(
        "Face verification was cancelled or failed. Please try again.",
      );
      setState("verifying");
      return;
    }

    setSessionId(newSessionId);
    checkStatus(verification.flowId, newSessionId, verification.profile);
  }, [verification, checkStatus]);

  const manualCheckStatus = useCallback(() => {
    if (!verification || !sessionId) return;
    console.log("[login] manual check-status tapped");
    checkStatus(verification.flowId, sessionId, verification.profile);
  }, [verification, sessionId, checkStatus]);

  const startOver = useCallback(() => {
    setVerification(null);
    setSessionId(null);
    setStatusError(null);
    setErrorMessage(null);
    setState("idle");
  }, []);

  const isBusy =
    state === "authorizing" || state === "starting" || state === "success";

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.hero}>
          <View style={styles.logoWrap}>
            <Image
              source={require("@/assets/images/logo-glow.png")}
              style={styles.logoGlow}
              contentFit="contain"
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Image
              source={require("@/assets/images/logo.png")}
              style={styles.logo}
              contentFit="contain"
              accessibilityLabel="AGAPAY"
            />
          </View>
          <Text style={styles.tagline}>
            Your healthcare journey, verified and secure.
          </Text>
          <View
            style={styles.flagAccent}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            <View style={styles.flagAccentBar} />
            <View style={[styles.flagAccentBar, styles.flagAccentBarRed]} />
          </View>
        </View>

        <View style={styles.card}>
          {state === "error" && errorMessage ? (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
              style={styles.errorBanner}
              accessibilityRole="alert"
            >
              <Text style={styles.errorText}>{errorMessage}</Text>
            </Animated.View>
          ) : null}

          {state === "success" && (
            <Animated.View
              entering={FadeIn.duration(250)}
              style={styles.statusRow}
            >
              <Text style={styles.successText} accessibilityLiveRegion="polite">
                Signed in — setting up your profile…
              </Text>
            </Animated.View>
          )}

          {state !== "success" && (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
              style={[
                styles.cta,
                isBusy && styles.ctaDisabled,
                ctaAnimatedStyle,
              ]}
            >
              <Pressable
                onPress={runLogin}
                onPressIn={() => {
                  // eslint-disable-next-line react-hooks/immutability -- Reanimated shared value mutation, not React state
                  ctaScale.value = withTiming(0.97, { duration: 100 });
                }}
                onPressOut={() => {
                  // eslint-disable-next-line react-hooks/immutability -- Reanimated shared value mutation, not React state
                  ctaScale.value = withTiming(1, { duration: 150 });
                }}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel="Continue with eGov SSO"
                accessibilityState={{ disabled: isBusy, busy: isBusy }}
                android_ripple={{ color: AuthColors.primaryPressed }}
                style={({ pressed }) => [
                  styles.ctaInner,
                  pressed && styles.ctaPressed,
                ]}
              >
                {isBusy ? (
                  <ActivityIndicator color={AuthColors.accent} />
                ) : (
                  <Text style={styles.ctaText}>Continue with eGov SSO</Text>
                )}
              </Pressable>
            </Animated.View>
          )}

          {state === "error" && (
            <Animated.View entering={FadeIn.duration(200)}>
              <Pressable
                onPress={runLogin}
                accessibilityRole="button"
                accessibilityLabel="Retry sign in"
                android_ripple={{ color: AuthColors.border }}
                style={styles.retry}
              >
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </Animated.View>
          )}

          <Text style={styles.consent}>
            By continuing, you agree to securely share your verified national ID
            details from eGovPH with AGAPAY for healthcare identification and
            services.
          </Text>
        </View>

        {__DEV__ && (
          <>
            <Pressable
              onPress={() => router.push("/auth/dev-login")}
              accessibilityRole="button"
              accessibilityLabel="Open developer sandbox sign-in"
              android_ripple={{ color: AuthColors.border }}
              style={styles.devLink}
            >
              <Text style={styles.devLinkText}>
                Developer: test with sandbox exchange code
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/auth/quick-login")}
              accessibilityRole="button"
              accessibilityLabel="Open developer quick login"
              android_ripple={{ color: AuthColors.border }}
              style={styles.devLink}
            >
              <Text style={styles.devLinkText}>
                Developer: quick login (skip liveness/eVerify)
              </Text>
            </Pressable>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AuthColors.background },
  safeArea: { flex: 1, justifyContent: "space-between", padding: 24 },
  hero: { alignItems: "center", gap: 12, marginTop: 48 },
  logoWrap: {
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  logoGlow: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  logo: { width: 190, aspectRatio: 1689 / 624 },
  tagline: {
    color: AuthColors.textSecondary,
    fontSize: 15,
    textAlign: "center",
  },
  flagAccent: { flexDirection: "row", gap: 6, marginTop: 4 },
  flagAccentBar: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: AuthColors.accent,
  },
  flagAccentBarRed: { backgroundColor: AuthColors.danger },
  card: {
    backgroundColor: AuthColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AuthColors.border,
    padding: 20,
    gap: 16,
  },
  cta: {
    minHeight: 48,
    borderRadius: 12,
    overflow: "hidden",
  },
  ctaInner: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: AuthColors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  ctaPressed: { backgroundColor: AuthColors.primaryPressed },
  ctaDisabled: { opacity: 0.8 },
  ctaText: { color: AuthColors.onPrimary, fontSize: 16, fontWeight: "600" },
  retry: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  retryText: { color: AuthColors.primary, fontSize: 15, fontWeight: "600" },
  statusRow: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  successText: { color: AuthColors.success, fontSize: 15, fontWeight: "600" },
  errorBanner: {
    backgroundColor: AuthColors.dangerBackground,
    borderRadius: 10,
    padding: 12,
  },
  errorText: { color: AuthColors.danger, fontSize: 14 },
  consent: { color: AuthColors.textSecondary, fontSize: 12, lineHeight: 18 },
  devLink: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  devLinkText: {
    color: AuthColors.textSecondary,
    fontSize: 12,
    textDecorationLine: "underline",
  },
});
