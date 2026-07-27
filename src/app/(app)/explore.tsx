import { useEffect } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset, Brand, Spacing } from '@/constants/theme';
import { useFacilities, type Facility } from '@/hooks/use-facilities';
import { useTheme } from '@/hooks/use-theme';

function FacilityCard({ facility }: { facility: Facility }) {
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${facility.lat},${facility.lng}`;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTypeBadge}>
          <Text style={styles.cardTypeText}>{facility.type}</Text>
        </View>
        <Text style={styles.cardDistance}>{facility.distance_km} km</Text>
      </View>
      <Text style={styles.cardName}>{facility.name}</Text>
      <Text style={styles.cardAddress}>{facility.address}</Text>
      <Pressable
        onPress={() => Linking.openURL(directionsUrl)}
        style={({ pressed }) => [styles.cardButton, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel={`Get directions to ${facility.name}`}>
        <Text style={styles.cardButtonText}>Get Directions</Text>
      </Pressable>
    </View>
  );
}

export default function ExploreScreen() {
  const theme = useTheme();
  const { data, loading, error, refresh } = useFacilities();

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.webContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}>
          <View style={styles.webBanner}>
            <Text style={styles.webBannerTitle}>Healthcare Facility Map</Text>
            <Text style={styles.webBannerText}>
              Map view is available on the mobile app. Below is a list of nearby facilities.
            </Text>
          </View>

          {loading && (
            <View style={styles.webLoading}>
              <ActivityIndicator size="large" color={Brand.textSecondary} />
              <Text style={styles.webLoadingText}>Loading facilities...</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {data.length === 0 && !loading && !error && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No facilities found nearby.</Text>
            </View>
          )}

          {data.map((facility) => (
            <FacilityCard key={facility.id} facility={facility} />
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  card: {
    backgroundColor: Brand.surface,
    borderRadius: 16,
    padding: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTypeBadge: {
    backgroundColor: '#F0F4F8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  cardTypeText: { fontSize: 11, fontWeight: '600', color: Brand.muted },
  cardDistance: { fontSize: 12, fontWeight: '500', color: Brand.muted },
  cardName: { fontSize: 15, fontWeight: '600', color: Brand.textPrimary },
  cardAddress: { fontSize: 13, color: Brand.textSecondary },
  cardButton: {
    minHeight: 32,
    borderRadius: 8,
    backgroundColor: Brand.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginTop: 4,
  },
  cardButtonText: { fontSize: 13, fontWeight: '600', color: Brand.primary },
  webContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  webBanner: {
    paddingTop: Spacing.four,
    alignItems: 'center',
    gap: Spacing.one,
  },
  webBannerTitle: { fontSize: 24, fontWeight: '700', color: Brand.textPrimary },
  webBannerText: { fontSize: 15, color: Brand.textSecondary, textAlign: 'center' },
  webLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: Spacing.two,
  },
  webLoadingText: { fontSize: 15, color: Brand.textSecondary },
  errorBanner: {
    backgroundColor: Brand.dangerBg,
    borderRadius: 12,
    padding: 12,
    gap: Spacing.two,
  },
  errorText: { color: Brand.danger, fontSize: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 15, color: Brand.textSecondary },
});
