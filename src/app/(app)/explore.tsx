import * as Location from 'expo-location';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
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

function NativeMapView({
  facilities,
  center,
  loading,
}: {
  facilities: Facility[];
  center: { lat: number; lng: number };
  loading: boolean;
}) {
  const markers = facilities.map((f) => ({
    id: f.id,
    coordinates: { latitude: f.lat, longitude: f.lng } as { latitude: number; longitude: number },
    title: f.name,
    snippet: `${f.type} — ${f.distance_km} km`,
  }));

  if (loading) {
    return (
      <View style={styles.mapLoading}>
        <ActivityIndicator size="large" color={Brand.primary} />
        <Text style={styles.mapLoadingText}>Loading map...</Text>
      </View>
    );
  }

  if (Platform.OS === 'ios') {
    return (
      <AppleMaps.View
        style={styles.map}
        cameraPosition={{
          coordinates: { latitude: center.lat, longitude: center.lng },
          zoom: 13,
        }}
        markers={markers.map((m) => ({
          coordinates: m.coordinates,
          title: m.title,
          monogram: m.title.charAt(0),
          tintColor: Brand.primary,
        }))}
        properties={{ isMyLocationEnabled: true }}
      />
    );
  }

  return (
    <GoogleMaps.View
      style={styles.map}
      cameraPosition={{
        coordinates: { latitude: center.lat, longitude: center.lng },
        zoom: 13,
      }}
      markers={markers.map((m) => ({
        coordinates: m.coordinates,
        title: m.title,
        snippet: m.snippet,
      }))}
      properties={{ isMyLocationEnabled: true }}
    />
  );
}

function WebFallback({
  facilities,
  loading,
  error,
}: {
  facilities: Facility[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <View style={styles.webLoading}>
        <ActivityIndicator size="large" color={light.text} />
        <Text style={styles.webLoadingText}>Loading facilities...</Text>
      </View>
    );
  }

  return (
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

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {facilities.length === 0 && !error && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No facilities found nearby.</Text>
        </View>
      )}

      {facilities.map((facility) => (
        <FacilityCard key={facility.id} facility={facility} />
      ))}
    </ScrollView>
  );
}

export default function ExploreScreen() {
  const theme = useTheme();
  const { data, loading, error, center, refresh } = useFacilities();
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      refresh();
      return;
    }

    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;

      setLocationGranted(status === 'granted');

      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        refresh({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } else {
        refresh();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const handleRefresh = useCallback(() => {
    refresh(locationGranted === true ? center : undefined);
  }, [refresh, locationGranted, center]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <WebFallback facilities={data} loading={loading} error={error} />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <NativeMapView facilities={data} center={center} loading={loading} />

      {!loading && locationGranted === false && (
        <View style={styles.locationBanner}>
          <Text style={styles.locationBannerText}>
            Enable location to find nearby facilities.
          </Text>
          <Pressable onPress={handleRefresh} style={styles.locationBannerButton}>
            <Text style={styles.locationBannerButtonText}>Retry</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.nativeListContainer}>
        <ScrollView
          style={styles.nativeList}
          contentContainerStyle={styles.nativeListContent}
          nestedScrollEnabled
          bounces={false}>
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={handleRefresh} style={styles.retryButton}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  map: { flex: 1 },
  mapLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  mapLoadingText: { fontSize: 15, color: Brand.textSecondary },
  locationBanner: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  locationBannerText: { flex: 1, fontSize: 14, color: '#92400E' },
  locationBannerButton: {
    backgroundColor: Brand.warning,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  locationBannerButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  nativeListContainer: {
    position: 'absolute',
    bottom: BottomTabInset + 8,
    left: 0,
    right: 0,
    maxHeight: '35%',
  },
  nativeList: { flex: 1 },
  nativeListContent: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
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
  retryButton: { alignSelf: 'flex-start' },
  retryText: { color: Brand.danger, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 15, color: Brand.textSecondary },
});
