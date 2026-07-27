import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthColors } from '@/constants/auth-theme';
import { Spacing } from '@/constants/theme';
import type { Facility } from '@/lib/health-navigation-types';

function statusLabel(facility: Facility): string {
  if (facility.openStatus === 'open') return 'Open now';
  if (facility.openStatus === 'closed') return 'Closed now';
  return 'Hours unavailable';
}

function FacilityRow({ facility, isLast }: { facility: Facility; isLast: boolean }) {
  return (
    <View style={[styles.row, !isLast && styles.rowDivider]}>
      <View style={styles.rowIconCircle}>
        <Ionicons name="business-outline" size={18} color={AuthColors.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>
          {facility.name}
        </Text>
        <Text style={styles.rowMeta}>
          {facility.distanceKm.toFixed(1)} km away · {statusLabel(facility)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={AuthColors.textSecondary} />
    </View>
  );
}

export function FacilityList({
  title,
  facilities,
  isLoading,
  errorMessage,
}: {
  title: string;
  facilities: Facility[] | null;
  isLoading: boolean;
  errorMessage: string | null;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>

      {isLoading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator color={AuthColors.primary} />
        </View>
      ) : errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : facilities && facilities.length > 0 ? (
        facilities.map((facility, index) => (
          <FacilityRow key={facility.id} facility={facility} isLast={index === facilities.length - 1} />
        ))
      ) : (
        <Text style={styles.emptyText}>No nearby facilities found. Try widening your search area.</Text>
      )}
    </View>
  );
}

export function FindFacilitiesButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Find facilities"
      style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, disabled && styles.disabled]}>
      <Text style={styles.primaryButtonText}>Find Facilities</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AuthColors.surface,
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    color: AuthColors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AuthColors.border,
  },
  rowIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    color: AuthColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  rowMeta: {
    color: AuthColors.textSecondary,
    fontSize: 12,
  },
  centerBlock: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  errorText: {
    color: AuthColors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyText: {
    color: AuthColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: AuthColors.primary,
    borderRadius: 999,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: AuthColors.onPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});
