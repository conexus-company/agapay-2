import { useEffect, useRef, useState } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications() {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [granted, setGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registered = useRef(false);

  useEffect(() => {
    if (!Device.isDevice) return;

    let cancelled = false;

    async function register() {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (cancelled) return;

      if (finalStatus !== 'granted') {
        setError('Notification permission denied');
        return;
      }

      setGranted(true);

      const tokenData = await Notifications.getExpoPushTokenAsync();
      if (cancelled) return;

      const token = tokenData.data;
      setPushToken(token);

      if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#1E3A8A',
        });
      }

      if (!registered.current) {
        registered.current = true;
        const platform = Platform.OS === 'ios' ? 'ios' : 'android';
        fetch('/api/notifications/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ push_token: token, platform }),
        }).catch(() => {});
      }
    }

    register();

    return () => {
      cancelled = true;
    };
  }, []);

  const deviceError = !Device.isDevice ? 'Push notifications require a physical device' : null;

  return { pushToken, granted, error: deviceError ?? error };
}
