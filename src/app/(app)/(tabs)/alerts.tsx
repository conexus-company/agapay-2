import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset, Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { formatRelativeTime } from '@/lib/format-relative-time';
import {
  fetchMyNotifications,
  getNotificationsAuthToken,
  markNotificationRead,
  type CitizenNotification,
  type NotificationCategory,
} from '@/lib/notifications';

const CATEGORY_META: Record<NotificationCategory, { icon: keyof typeof Ionicons.glyphMap; bg: string; text: string }> = {
  queue: { icon: 'list-outline', bg: Brand.infoBg, text: Brand.infoText },
  appointment: { icon: 'calendar-outline', bg: Brand.successBg, text: Brand.successText },
  health_advisory: { icon: 'medkit-outline', bg: Brand.warningBg, text: Brand.warning },
  system: { icon: 'notifications-outline', bg: Brand.mutedBg, text: Brand.mutedText },
};

function navigateToAction(route: string | null) {
  if (!route) return;
  switch (route) {
    case '/queue':
      router.push('/queue');
      break;
    case '/facilities':
      router.push('/facilities');
      break;
    case '/health-navigation':
      router.push('/health-navigation');
      break;
    case '/':
      router.push('/');
      break;
    default:
      break;
  }
}

function NotificationCard({
  item,
  onPress,
}: {
  item: CitizenNotification;
  onPress: () => void;
}) {
  const meta = CATEGORY_META[item.category] ?? CATEGORY_META.system;
  const isUnread = !item.is_read;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      style={({ pressed }) => [
        styles.card,
        isUnread && styles.cardUnread,
        pressed && styles.pressed,
      ]}>
      <View style={[styles.cardIcon, { backgroundColor: meta.bg }]}>
        <Ionicons name={meta.icon} size={20} color={meta.text} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, isUnread && styles.cardTitleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          {isUnread && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.cardBodyText} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={styles.cardTime}>{formatRelativeTime(item.created_at)}</Text>
      </View>
      {item.action_route && (
        <Ionicons name="chevron-forward" size={18} color={Brand.muted} style={styles.cardChevron} />
      )}
    </Pressable>
  );
}

export default function AlertsScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const profile = session?.profile;

  const token = useMemo(() => getNotificationsAuthToken(profile), [profile]);
  usePushNotifications(token);

  const [notifications, setNotifications] = useState<CitizenNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    const result = await fetchMyNotifications(profile);
    if (!result.ok) {
      setError(
        result.kind === 'network_error'
          ? 'Network error'
          : result.kind === 'invalid_response'
            ? result.message
            : 'Could not load your alerts right now.',
      );
      setLoading(false);
      return;
    }
    setNotifications(result.data.notifications);
    setError(null);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications],
  );

  const handleOpen = useCallback(
    async (item: CitizenNotification) => {
      if (!item.is_read) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)),
        );
        await markNotificationRead(profile, item.id);
      }
      navigateToAction(item.action_route);
    },
    [profile],
  );

  const handleMarkAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.is_read);
    if (unread.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await Promise.all(unread.map((n) => markNotificationRead(profile, n.id)));
  }, [notifications, profile]);

  if (loading && notifications.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text style={styles.loadingText}>Loading your alerts…</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Alerts</Text>
            <Text style={styles.subtitle}>
              Important updates about your healthcare journey.
            </Text>
          </View>

          {error && notifications.length === 0 && (
            <View style={styles.errorBlock}>
              <View style={styles.errorIconCircle}>
                <Ionicons name="alert-circle-outline" size={32} color={Brand.danger} />
              </View>
              <Text style={styles.errorTitle}>Can&apos;t load your alerts</Text>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable
                onPress={refresh}
                accessibilityRole="button"
                accessibilityLabel="Retry loading alerts"
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>Try again</Text>
              </Pressable>
            </View>
          )}

          {unreadCount > 0 && (
            <View style={styles.unreadBanner}>
              <View style={styles.unreadBannerTextBlock}>
                <Ionicons name="notifications" size={16} color={Brand.infoText} />
                <Text style={styles.unreadBannerText}>
                  {unreadCount === 1 ? '1 new update' : `${unreadCount} new updates`}
                </Text>
              </View>
              <Pressable
                onPress={handleMarkAllRead}
                accessibilityRole="button"
                accessibilityLabel="Mark all alerts as read"
                style={({ pressed }) => [styles.markAllButton, pressed && styles.pressed]}>
                <Text style={styles.markAllText}>Mark all read</Text>
              </Pressable>
            </View>
          )}

          {notifications.length === 0 && error === null && (
            <View style={styles.emptyBlock}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="notifications-off-outline" size={40} color={Brand.primary} />
              </View>
              <Text style={styles.emptyTitle}>You&apos;re all caught up</Text>
              <Text style={styles.emptyText}>
                Appointment reminders, queue updates, and health advisories will appear here.
              </Text>
              <Pressable
                onPress={() => router.push('/health-navigation')}
                accessibilityRole="button"
                accessibilityLabel="Get health advice"
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>Get health advice</Text>
              </Pressable>
            </View>
          )}

          {notifications.map((item) => (
            <NotificationCard key={item.id} item={item} onPress={() => handleOpen(item)} />
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  header: { paddingTop: Spacing.four, gap: Spacing.half },
  title: { fontSize: 28, fontWeight: '700', lineHeight: 34 },
  subtitle: { fontSize: 14, color: Brand.textSecondary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  loadingText: { fontSize: 14, color: Brand.textSecondary },
  unreadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Brand.infoBg,
    borderRadius: 12,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  unreadBannerTextBlock: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  unreadBannerText: { fontSize: 14, fontWeight: '600', color: Brand.infoText },
  markAllButton: { paddingVertical: 4, paddingHorizontal: Spacing.two },
  markAllText: { fontSize: 13, fontWeight: '700', color: Brand.infoText },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: Brand.surface,
    borderRadius: 16,
    padding: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardUnread: {
    borderWidth: 1,
    borderColor: Brand.infoText,
    backgroundColor: '#F8FBFF',
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: Brand.textPrimary },
  cardTitleUnread: { fontWeight: '800' },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Brand.danger,
  },
  cardBodyText: { fontSize: 13, color: Brand.textSecondary, lineHeight: 18 },
  cardTime: { fontSize: 12, color: Brand.muted, marginTop: 2 },
  cardChevron: { marginLeft: Spacing.one },
  emptyBlock: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Brand.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Brand.textPrimary },
  emptyText: {
    fontSize: 14,
    color: Brand.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.three,
  },
  errorBlock: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
  errorIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Brand.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: { fontSize: 18, fontWeight: '700', color: Brand.textPrimary },
  errorText: { fontSize: 14, color: Brand.textSecondary, textAlign: 'center', lineHeight: 20 },
  primaryButton: {
    marginTop: Spacing.two,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
