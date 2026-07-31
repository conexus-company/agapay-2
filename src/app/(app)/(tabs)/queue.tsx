import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset, Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { useQueueStatus, type QueueStatus } from '@/hooks/use-queue-status';
import { fetchMyQueueTickets, getQueueAuthToken, type QueueTicket } from '@/lib/queue';

const STATUS_STYLES: Record<QueueStatus, { bg: string; text: string; label: string }> = {
  waiting: { bg: Brand.mutedBg, text: Brand.mutedText, label: 'Waiting' },
  called: { bg: Brand.infoBg, text: Brand.infoText, label: 'Called' },
  completed: { bg: Brand.successBg, text: Brand.successText, label: 'Completed' },
  no_show: { bg: Brand.dangerBg, text: Brand.dangerText, label: 'No Show' },
};

function formatCheckedInAt(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function StatusPill({ status }: { status: QueueStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <View style={[styles.pill, { backgroundColor: style.bg }]}>
      <Text style={[styles.pillText, { color: style.text }]}>{style.label}</Text>
    </View>
  );
}

function TicketRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.ticketRow}>
      <Text style={styles.ticketLabel}>{label}</Text>
      <Text style={styles.ticketValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const STATUS_BANNERS: Record<QueueStatus, { bg: string; text: string; label: string }> = {
  waiting: {
    bg: Brand.primary,
    text: '#FFFFFF',
    label: 'You are in the queue. We will notify you when it is your turn.',
  },
  called: {
    bg: Brand.infoBg,
    text: Brand.infoText,
    label: 'You are being called. Please proceed to the counter.',
  },
  completed: {
    bg: Brand.successBg,
    text: Brand.successText,
    label: 'Your visit is complete. Thank you!',
  },
  no_show: {
    bg: Brand.dangerBg,
    text: Brand.dangerText,
    label: 'You were marked as a no-show. Please see the front desk if this is a mistake.',
  },
};

function ActiveTicketCard({ ticket, status }: { ticket: QueueTicket; status: QueueStatus | null }) {
  const currentStatus = status ?? ticket.status;
  const banner = STATUS_BANNERS[currentStatus];

  return (
    <View style={styles.activeCard}>
      <View style={styles.activeHeader}>
        <Text style={styles.queueNumber}>{ticket.queue_number}</Text>
        <StatusPill status={currentStatus} />
      </View>

      <View style={[styles.statusBanner, { backgroundColor: banner.bg }]}>
        <Text style={[styles.statusBannerText, { color: banner.text }]}>{banner.label}</Text>
      </View>

      <View style={styles.detailsBlock}>
        <TicketRow label="Facility" value={ticket.facility_id} />
        <TicketRow label="Service" value={ticket.service_type} />
        <TicketRow label="Checked in" value={formatCheckedInAt(ticket.checked_in_at)} />
      </View>
    </View>
  );
}

function HistoryCard({ ticket }: { ticket: QueueTicket }) {
  return (
    <View style={styles.historyCard}>
      <View style={styles.historyHeader}>
        <Text style={styles.historyNumber}>{ticket.queue_number}</Text>
        <StatusPill status={ticket.status} />
      </View>
      <View style={styles.detailsBlock}>
        <TicketRow label="Facility" value={ticket.facility_id} />
        <TicketRow label="Service" value={ticket.service_type} />
        <TicketRow label="Checked in" value={formatCheckedInAt(ticket.checked_in_at)} />
      </View>
    </View>
  );
}

export default function QueueScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const profile = session?.profile;

  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const token = useMemo(() => getQueueAuthToken(profile), [profile]);

  const refresh = useCallback(async () => {
    const result = await fetchMyQueueTickets(profile);
    if (!result.ok) {
      setError(
        result.kind === 'network_error'
          ? 'Network error'
          : result.kind === 'invalid_response'
            ? result.message
            : 'Could not load your queue status right now.',
      );
      setLoading(false);
      return;
    }
    setTickets(result.data);
    setError(null);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const activeTicket = useMemo(
    () => tickets.find((t) => t.status === 'waiting' || t.status === 'called') ?? null,
    [tickets],
  );

  const { status: liveStatus, loading: statusLoading } = useQueueStatus({
    ticketId: activeTicket?.id ?? null,
    token,
  });

  // The hook only emits events for waiting→called/completed; a called→completed
  // transition still shows up in the polled status, so move the ticket to
  // history (refresh the list) whenever the live status turns terminal.
  // Deferred via setTimeout so the refresh runs after the effect commit.
  useEffect(() => {
    if (liveStatus === 'completed' || liveStatus === 'no_show') {
      const timeout = setTimeout(() => refresh(), 0);
      return () => clearTimeout(timeout);
    }
  }, [liveStatus, refresh]);

  const history = useMemo(
    () => tickets.filter((t) => t.status === 'completed' || t.status === 'no_show'),
    [tickets],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  if (loading && tickets.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text style={styles.loadingText}>Loading your queue status…</Text>
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
            <Text style={[styles.title, { color: theme.text }]}>Queue Status</Text>
          </View>

          {error && tickets.length === 0 && (
            <View style={styles.errorBlock}>
              <View style={styles.errorIconCircle}>
                <Ionicons name="alert-circle-outline" size={32} color={Brand.danger} />
              </View>
              <Text style={styles.errorTitle}>Can&apos;t load your queue</Text>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable
                onPress={refresh}
                accessibilityRole="button"
                accessibilityLabel="Retry loading queue status"
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
                <Text style={styles.retryButtonText}>Try again</Text>
              </Pressable>
            </View>
          )}

          {activeTicket && (
            <>
              <ActiveTicketCard ticket={activeTicket} status={liveStatus} />
              {statusLoading && (
                <View style={styles.pollingRow}>
                  <ActivityIndicator size="small" color={Brand.primary} />
                  <Text style={styles.pollingText}>Checking for updates…</Text>
                </View>
              )}
            </>
          )}

          {!activeTicket && error === null && tickets.length === 0 && (
            <View style={styles.emptyBlock}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="list-outline" size={40} color={Brand.primary} />
              </View>
              <Text style={styles.emptyTitle}>No active queue</Text>
              <Text style={styles.emptyText}>
                Check in at a facility to see your queue position and live updates here.
              </Text>
              <Pressable
                onPress={() => router.push('/explore')}
                accessibilityRole="button"
                accessibilityLabel="Find a facility"
                style={({ pressed }) => [styles.findButton, pressed && styles.pressed]}>
                <Text style={styles.findButtonText}>Find a Facility</Text>
              </Pressable>
            </View>
          )}

          {history.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Recent</Text>
              {history.map((ticket) => (
                <HistoryCard key={ticket.id} ticket={ticket} />
              ))}
            </>
          )}
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
  header: { paddingTop: Spacing.four },
  title: { fontSize: 28, fontWeight: '700', lineHeight: 34 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  loadingText: { fontSize: 14, color: Brand.textSecondary },
  activeCard: {
    backgroundColor: Brand.surface,
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  activeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  queueNumber: { fontSize: 32, fontWeight: '800', color: Brand.textPrimary, fontFamily: 'monospace', letterSpacing: 1 },
  pill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  pillText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  statusBanner: { borderRadius: 12, padding: Spacing.three },
  statusBannerText: { fontSize: 14, fontWeight: '600', lineHeight: 20, textAlign: 'center' },
  detailsBlock: { gap: 0 },
  ticketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.background,
  },
  ticketLabel: { fontSize: 14, color: Brand.textSecondary },
  ticketValue: { fontSize: 14, fontWeight: '600', color: Brand.textPrimary, flexShrink: 1, textAlign: 'right' },
  pollingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  pollingText: { fontSize: 13, color: Brand.textSecondary },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Brand.textPrimary, marginTop: Spacing.one },
  historyCard: {
    backgroundColor: Brand.surface,
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyNumber: { fontSize: 16, fontWeight: '700', color: Brand.textPrimary, fontFamily: 'monospace' },
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
  emptyText: { fontSize: 14, color: Brand.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: Spacing.three },
  findButton: {
    marginTop: Spacing.two,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },
  findButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
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
  retryButton: {
    marginTop: Spacing.two,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },
  retryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
