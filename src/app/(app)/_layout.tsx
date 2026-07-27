import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="health-id" />
      <Stack.Screen name="health-navigation" />
      <Stack.Screen name="coming-soon" />
    </Stack>
  );
}
