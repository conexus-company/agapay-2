import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { AuthColors } from '@/constants/auth-theme';

/**
 * Redirect target for the Face Liveness callback (auth/liveness-callback).
 *
 * On native, WebBrowser.openAuthSessionAsync intercepts this redirect at the
 * OS level before Expo Router's own linking listener sees it, but on some
 * platforms (notably Android) that listener can independently try to
 * navigate here too — without a matching route, that shows "Unmatched Route"
 * instead of continuing the in-flight verification. Bouncing back to the
 * login screen there is harmless because the native session was already
 * resolved by the OS-level interception.
 *
 * On web there is no OS-level interception: openAuthSessionAsync opens a
 * real popup and its promise only resolves once *this* page calls
 * WebBrowser.maybeCompleteAuthSession(), which posts the redirect URL back
 * to the opener tab. Without that call the opener hangs forever waiting
 * after the face scan completes.
 */
export default function LivenessCallbackScreen() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      const result = WebBrowser.maybeCompleteAuthSession();
      if (result.type === 'success') {
        // The opener tab has the result now and will close this popup.
        return;
      }
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/auth');
    }
  }, []);

  return (
    <View style={styles.screen}>
      <ActivityIndicator color={AuthColors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: AuthColors.background },
});
