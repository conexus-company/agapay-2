import { Stack } from 'expo-router';

export default function AppointmentsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="schedule-selection" />
      <Stack.Screen name="confirmation" />
    </Stack>
  );
}
