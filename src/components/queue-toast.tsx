import { useCallback, useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Brand, Spacing } from '@/constants/theme';
import type { QueueStatus } from '@/hooks/use-queue-status';

interface QueueToastProps {
  status: QueueStatus | null;
  queueNumber: string | null;
  ticketId: string | null;
}

const STATUS_MESSAGES: Record<QueueStatus, string> = {
  called: 'You are being called. Please proceed to the counter.',
  completed: 'Your queue has been completed.',
  waiting: '',
  no_show: 'You have been marked as no show.',
};

export function QueueToast({ status, queueNumber, ticketId }: QueueToastProps) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [fadeKey, setFadeKey] = useState(0);

  const isActive = status === 'called' || status === 'completed';

  useEffect(() => {
    if (!isActive) return;

    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      setFadeKey((k) => k + 1);
    }, 10_000);

    return () => clearTimeout(timer);
  }, [isActive, fadeKey, opacity]);

  const dismiss = useCallback(() => {
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    setFadeKey((k) => k + 1);
  }, [opacity]);

  const handleViewTicket = useCallback(() => {
    dismiss();
    if (ticketId) router.push(`/appointment/${ticketId}`);
  }, [dismiss, ticketId]);

  if (!isActive || !queueNumber) return null;

  const bgColor = status === 'called' ? Brand.infoBg : Brand.successBg;
  const textColor = status === 'called' ? Brand.infoText : Brand.successText;

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: bgColor, opacity }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive">
      <View style={styles.content}>
        <Text style={[styles.title, { color: textColor }]}>
          Queue {queueNumber} — {status === 'called' ? 'Called' : 'Completed'}
        </Text>
        <Text style={[styles.body, { color: textColor }]}>{STATUS_MESSAGES[status]}</Text>
        <View style={styles.actions}>
          <Pressable onPress={handleViewTicket} style={styles.viewBtn}>
            <Text style={[styles.viewBtnText, { color: Brand.primary }]}>View ticket</Text>
          </Pressable>
          <Pressable onPress={dismiss} style={styles.dismissBtn}>
            <Text style={[styles.dismissBtnText, { color: Brand.muted }]}>Dismiss</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.three,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  content: { gap: Spacing.one },
  title: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  viewBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: Brand.surface },
  viewBtnText: { fontSize: 13, fontWeight: '600' },
  dismissBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  dismissBtnText: { fontSize: 13, fontWeight: '500' },
});
