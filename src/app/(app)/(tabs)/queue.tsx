import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthColors } from '@/constants/auth-theme';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { resolveSsoSubjectId } from '@/lib/health-profile';
import { useQueueStatus, type QueueStatus } from '@/hooks/use-queue-status';

type MineTicket = {
  ticket_id: string;
  queue_number: string;
  facility_id: string;
  service_type: string;
};

type MineTicketResult = { ticket: MineTicket | null } | { error: string };

async function loadMyTicket(profile: unknown): Promise<MineTicketResult> {
  try {
    const token = resolveSsoSubjectId(profile);
    const res = await fetch('/api/checkin/mine', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: body.error ?? 'Failed to load your queue ticket' };
    }

    const body = await res.json();
    return { ticket: body.ticket ?? null };
  } catch {
    return { error: 'Network error' };
  }
}

const STATUS_META: Record<QueueStatus, { label: string; bg: string; text: string }> = {
  waiting: { label: 'Waiting', bg: '#F3F4F6', text: '#374151' },
  called: { label: 'Called — please proceed', bg: '#DBEAFE', text: '#1E40AF' },
  completed: { label: 'Completed', bg: '#D1FAE5', text: '#065F46' },
  no_show: { label: 'No Show', bg: AuthColors.dangerBackground, text: AuthColors.danger },
};

function Header() {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Queue</Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.centerBlock}>
      <View style={styles.iconCircle}>
        <Ionicons name="list-outline" size={32} color={AuthColors.primary} />
      </View>
      <Text style={styles.emptyTitle}>No active queue ticket</Text>
      <Text style={styles.emptySubtitle}>Check in at a facility to join the digital queue and track your number here.</Text>
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.centerBlock}>
      <View style={[styles.iconCircle, { backgroundColor: AuthColors.dangerBackground }]}>
        <Ionicons name="alert-circle-outline" size={32} color={AuthColors.danger} />
      </View>
      <Text style={styles.emptyTitle}>Couldn&apos;t load your queue status</Text>
      <Text style={styles.emptySubtitle}>{message}</Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Try again"
        style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
        <Text style={styles.retryButtonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

function TicketCard({ ticket, status, error }: { ticket: MineTicket; status: QueueStatus | null; error: string | null }) {
  const meta = status ? STATUS_META[status] : null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>YOUR QUEUE NUMBER</Text>
      <Text style={styles.queueNumber}>{ticket.queue_number}</Text>
      <Text style={styles.serviceType}>{ticket.service_type}</Text>

      {meta && (
        <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
          <Text style={[styles.statusPillText, { color: meta.text }]}>{meta.label}</Text>
        </View>
      )}

      {error && (
        <View style={styles.inlineErrorBanner} accessibilityRole="alert">
          <Text style={styles.inlineErrorText}>Live updates paused: {error}</Text>
        </View>
      )}
    </View>
  );
}

export default function QueueScreen() {
  const { session } = useAuth();

  const [ticket, setTicket] = useState<MineTicket | null>(null);
  const [loadingMine, setLoadingMine] = useState(true);
  const [mineError, setMineError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoadingMine(true);
      setMineError(null);
      const result = await loadMyTicket(session?.profile);
      if (cancelled) return;
      if ('error' in result) {
        setMineError(result.error);
        setTicket(null);
      } else {
        setTicket(result.ticket);
      }
      setLoadingMine(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const refreshTicket = useCallback(async () => {
    setRefreshing(true);
    setMineError(null);
    const result = await loadMyTicket(session?.profile);
    if ('error' in result) {
      setMineError(result.error);
      setTicket(null);
    } else {
      setTicket(result.ticket);
    }
    setRefreshing(false);
  }, [session]);

  const { status, error: statusError } = useQueueStatus({
    ticketId: ticket?.ticket_id ?? null,
    onStatusChange: useCallback(
      (newStatus: QueueStatus) => {
        if (newStatus === 'completed' || newStatus === 'no_show') refreshTicket();
      },
      [refreshTicket],
    ),
  });

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshTicket} tintColor={AuthColors.primary} />}>
          {loadingMine ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator size="large" color={AuthColors.primary} />
              <Text style={styles.emptySubtitle}>Checking your queue status…</Text>
            </View>
          ) : mineError ? (
            <ErrorState message={mineError} onRetry={refreshTicket} />
          ) : !ticket ? (
            <EmptyState />
          ) : (
            <TicketCard ticket={ticket} status={status} error={statusError} />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AuthColors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: AuthColors.text,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  centerBlock: {
    flex: 1,
    minHeight: 400,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AuthColors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: AuthColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    minHeight: 44,
    backgroundColor: AuthColors.primary,
    borderRadius: 999,
    paddingHorizontal: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: AuthColors.onPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
  card: {
    backgroundColor: AuthColors.surface,
    borderRadius: 20,
    padding: Spacing.five,
    marginTop: Spacing.three,
    gap: Spacing.two,
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: AuthColors.textSecondary,
    letterSpacing: 0.5,
  },
  queueNumber: {
    fontSize: 40,
    fontWeight: '800',
    color: AuthColors.text,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  serviceType: {
    fontSize: 15,
    color: AuthColors.textSecondary,
  },
  statusPill: {
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 14,
    fontWeight: '700',
  },
  inlineErrorBanner: {
    marginTop: Spacing.three,
    backgroundColor: AuthColors.dangerBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AuthColors.danger,
    padding: Spacing.three,
    alignSelf: 'stretch',
  },
  inlineErrorText: {
    color: AuthColors.danger,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
