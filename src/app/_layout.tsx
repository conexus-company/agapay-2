import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { HealthProfileSetupProvider } from '@/contexts/health-profile-setup-context';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { status } = useAuth();

  // Native splash stays up (see SplashScreen.preventAutoHideAsync above)
  // until the stored session has been checked, so we never flash the login
  // screen for an already-signed-in citizen.
  if (status === 'loading') {
    return null;
  }

  return (
    <>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={status === 'signedIn'}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="auth" />
          <Stack.Screen name="health-profile-setup" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <HealthProfileSetupProvider>
          <RootNavigator />
        </HealthProfileSetupProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
