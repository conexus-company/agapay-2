import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthColors } from '@/constants/auth-theme';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { MOCK_FACILITIES } from '@/lib/mock-facilities';
import type { Facility } from '@/lib/health-navigation-types';

type FilterKey = 'Government' | 'Private' | 'Nearby' | 'Open Now';
const FILTERS: FilterKey[] = ['Government', 'Private', 'Nearby', 'Open Now'];

function matchesFilter(facility: Facility, filter: FilterKey): boolean {
  if (filter === 'Government') return facility.type === 'Government';
  if (filter === 'Private') return facility.type === 'Private';
  if (filter === 'Open Now') return facility.openStatus === 'open';
  return true; // Nearby — no extra predicate, list is already distance-sorted
}

function FacilityCard({ facility }: { facility: Facility }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/facilities/[id]', params: { id: facility.id } })}
      accessibilityRole="button"
      accessibilityLabel={`View details for ${facility.name}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardIconBox}>
        <Ionicons name={facility.icon ?? 'business-outline'} size={26} color={AuthColors.primary} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>
          {facility.name}
        </Text>
        <View style={styles.cardMetaRow}>
          <Ionicons name="location" size={13} color={AuthColors.danger} />
          <Text style={styles.cardMetaText}>{facility.distanceKm.toFixed(1)} km</Text>
          <Ionicons name="star" size={13} color={AuthColors.accent} style={styles.cardMetaStar} />
          <Text style={styles.cardMetaText}>{(facility.rating ?? 0).toFixed(1)}</Text>
          {facility.type && (
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{facility.type}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={[styles.statusPill, facility.openStatus !== 'open' && styles.statusPillClosed]}>
        <Text style={[styles.statusPillText, facility.openStatus !== 'open' && styles.statusPillTextClosed]}>
          {facility.openStatus === 'open' ? 'Open' : 'Closed'}
        </Text>
      </View>
    </Pressable>
  );
}

export default function FindFacilitiesScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>('Government');

  const facilities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return MOCK_FACILITIES.filter((facility) => {
      if (query) {
        const haystack = `${facility.name} ${facility.address ?? ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return matchesFilter(facility, selectedFilter);
    }).sort((a, b) => a.distanceKm - b.distanceKm);
  }, [searchQuery, selectedFilter]);

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={22} color={AuthColors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Find Facilities</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={AuthColors.textSecondary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search hospitals or clinics"
            placeholderTextColor={AuthColors.textSecondary}
            style={styles.searchInput}
            accessibilityLabel="Search hospitals or clinics"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={styles.filterScroll}>
          {FILTERS.map((filter) => {
            const selected = filter === selectedFilter;
            return (
              <Pressable
                key={filter}
                onPress={() => setSelectedFilter(filter)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Filter by ${filter}`}
                style={({ pressed }) => [styles.filterChip, selected && styles.filterChipSelected, pressed && styles.pressed]}>
                <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{filter}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {facilities.length > 0 ? (
            facilities.map((facility) => <FacilityCard key={facility.id} facility={facility} />)
          ) : (
            <View style={styles.emptyBlock}>
              <Ionicons name="search-outline" size={32} color={AuthColors.textSecondary} />
              <Text style={styles.emptyText}>No facilities match your search.</Text>
            </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing.two,
  },
  headerSpacer: {
    width: 44 - Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: AuthColors.text,
    textAlign: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: AuthColors.surface,
    borderRadius: 14,
    marginHorizontal: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderColor: AuthColors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: AuthColors.text,
  },
  filterScroll: {
    flexGrow: 0,
    marginTop: Spacing.three,
  },
  filterRow: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  filterChip: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: Spacing.four,
    backgroundColor: AuthColors.surface,
    borderWidth: 1,
    borderColor: AuthColors.border,
  },
  filterChipSelected: {
    backgroundColor: AuthColors.primary,
    borderColor: AuthColors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: AuthColors.textSecondary,
  },
  filterChipTextSelected: {
    color: AuthColors.onPrimary,
  },
  list: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    backgroundColor: AuthColors.surface,
    borderRadius: 18,
    padding: Spacing.three,
  },
  cardIconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: Spacing.one,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: AuthColors.text,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  cardMetaStar: {
    marginLeft: Spacing.one,
  },
  cardMetaText: {
    fontSize: 12,
    color: AuthColors.textSecondary,
  },
  typeBadge: {
    marginLeft: Spacing.one,
    backgroundColor: '#EEF2F7',
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: AuthColors.primary,
  },
  statusPill: {
    backgroundColor: '#D1FAE5',
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
  statusPillClosed: {
    backgroundColor: AuthColors.dangerBackground,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: AuthColors.success,
  },
  statusPillTextClosed: {
    color: AuthColors.danger,
  },
  emptyBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
  },
  emptyText: {
    fontSize: 13,
    color: AuthColors.textSecondary,
  },
});
