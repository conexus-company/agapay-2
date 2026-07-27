import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { AuthColors } from '@/constants/auth-theme';
import { Spacing } from '@/constants/theme';
import { formatRelativeTime } from '@/lib/format-relative-time';
import type { JourneyEvent, JourneyEventKind } from '@/lib/journey';

const JOURNEY_ICONS: Record<JourneyEventKind, keyof typeof Ionicons.glyphMap> = {
  identity: 'shield-checkmark-outline',
  appointment: 'calendar-outline',
  checkin: 'log-in-outline',
  update: 'medkit-outline',
};

const STATUS_LABELS: Record<'upcoming' | 'active', string> = {
  upcoming: 'Upcoming',
  active: 'Active',
};

export function TimelineEntry({ event, isLast }: { event: JourneyEvent; isLast: boolean }) {
  const showStatusPill = event.status === 'upcoming' || event.status === 'active';

  return (
    <View style={styles.row}>
      <View style={styles.railColumn}>
        <View style={styles.iconCircle}>
          <Ionicons name={JOURNEY_ICONS[event.kind]} size={18} color={AuthColors.primary} />
        </View>
        {!isLast && <View style={styles.connector} />}
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{event.title}</Text>
          {showStatusPill && (
            <View style={[styles.statusPill, event.status === 'active' && styles.statusPillActive]}>
              <Text style={[styles.statusPillText, event.status === 'active' && styles.statusPillTextActive]}>
                {STATUS_LABELS[event.status as 'upcoming' | 'active']}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.subtitle}>{event.subtitle}</Text>
        <Text style={styles.timestamp}>{formatRelativeTime(event.timestamp)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  railColumn: {
    alignItems: 'center',
    width: 36,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    flex: 1,
    width: 2,
    minHeight: Spacing.four,
    backgroundColor: AuthColors.border,
    marginTop: Spacing.one,
  },
  content: {
    flex: 1,
    paddingBottom: Spacing.four,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    color: AuthColors.text,
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  subtitle: {
    color: AuthColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  timestamp: {
    color: AuthColors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  statusPill: {
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  statusPillText: {
    color: AuthColors.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  statusPillActive: {
    backgroundColor: '#D1FAE5',
  },
  statusPillTextActive: {
    color: AuthColors.success,
  },
});
