import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthColors } from '@/constants/auth-theme';
import { Spacing } from '@/constants/theme';
import type { Doctor, Facility, FacilityHours } from '@/lib/health-navigation-types';
import { getFacilityById } from '@/lib/mock-facilities';

type TabKey = 'Services' | 'Doctors' | 'Hours';
const TABS: TabKey[] = ['Services', 'Doctors', 'Hours'];

function formatHour(value: string): string {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return value;
  const hour24 = Number(match[1]);
  const minute = match[2];
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute} ${period}`;
}

function getInitials(name: string): string {
  const parts = name.replace(/^Dr\.\s*/i, '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function EmptyTabState({ message }: { message: string }) {
  return (
    <View style={styles.emptyTab}>
      <Text style={styles.emptyTabText}>{message}</Text>
    </View>
  );
}

function ServicesTab({ services }: { services: string[] }) {
  if (services.length === 0) return <EmptyTabState message="No information available." />;
  return (
    <View style={styles.chipWrap}>
      {services.map((service) => (
        <View key={service} style={styles.chip}>
          <Text style={styles.chipText}>{service}</Text>
        </View>
      ))}
    </View>
  );
}

function DoctorRow({ doctor, isLast }: { doctor: Doctor; isLast: boolean }) {
  return (
    <View style={[styles.doctorRow, !isLast && styles.rowDivider]}>
      <View style={styles.doctorAvatar}>
        <Text style={styles.doctorAvatarText}>{getInitials(doctor.name)}</Text>
      </View>
      <View style={styles.doctorText}>
        <Text style={styles.doctorName}>{doctor.name}</Text>
        <Text style={styles.doctorSpecialty}>{doctor.specialty}</Text>
      </View>
    </View>
  );
}

function DoctorsTab({ doctors }: { doctors: Doctor[] }) {
  if (doctors.length === 0) return <EmptyTabState message="No information available." />;
  return (
    <View style={styles.doctorList}>
      {doctors.map((doctor, index) => (
        <DoctorRow key={doctor.id} doctor={doctor} isLast={index === doctors.length - 1} />
      ))}
    </View>
  );
}

function HoursTab({ hours }: { hours: FacilityHours[] }) {
  if (hours.length === 0) return <EmptyTabState message="No information available." />;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  return (
    <View style={styles.hoursList}>
      {hours.map((entry, index) => {
        const isToday = entry.day === today;
        const isClosed = !entry.open || !entry.close;
        return (
          <View key={entry.day} style={[styles.hoursRow, index !== hours.length - 1 && styles.rowDivider]}>
            <Text style={[styles.hoursDay, isToday && styles.hoursDayToday]}>{entry.day}</Text>
            <Text style={[styles.hoursTime, isToday && styles.hoursDayToday, isClosed && styles.hoursClosed]}>
              {isClosed ? 'Closed' : `${formatHour(entry.open)} - ${formatHour(entry.close)}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function ErrorState({ facilityId }: { facilityId: string | undefined }) {
  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.errorSafeArea}>
        <View style={styles.errorBlock}>
          <View style={styles.errorIconCircle}>
            <Ionicons name="alert-circle-outline" size={32} color={AuthColors.danger} />
          </View>
          <Text style={styles.errorTitle}>Facility not found</Text>
          <Text style={styles.errorSubtitle}>
            {facilityId
              ? "We couldn't find details for this facility. It may no longer be available."
              : 'No facility was specified.'}
          </Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [styles.errorButton, pressed && styles.pressed]}>
            <Text style={styles.errorButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function BookAppointmentBar({ facility }: { facility: Facility }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/coming-soon',
            params: {
              title: 'Book Appointment',
              subtitle: `Booking at ${facility.name} is coming soon.`,
              icon: 'calendar-outline',
              facilityId: facility.id,
            },
          })
        }
        accessibilityRole="button"
        accessibilityLabel={`Book an appointment at ${facility.name}`}
        style={({ pressed }) => [styles.bookButton, pressed && styles.pressed]}>
        <Text style={styles.bookButtonText}>Book Appointment</Text>
      </Pressable>
    </View>
  );
}

export default function FacilityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>('Services');
  const insets = useSafeAreaInsets();

  const facility = id ? getFacilityById(id) : undefined;

  if (!facility) {
    return <ErrorState facilityId={id} />;
  }

  const isOpen = facility.openStatus === 'open';

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#5688D6', AuthColors.primary, '#1F3D6B']} style={styles.banner}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.bannerBack, { top: insets.top + Spacing.two }, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={AuthColors.text} />
        </Pressable>
        <View style={styles.bannerIconCircle}>
          <Ionicons name={facility.icon ?? 'business-outline'} size={44} color="#FFFFFF" />
        </View>
      </LinearGradient>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={2}>
            {facility.name}
          </Text>
          {facility.isVerified && (
            <View style={styles.verifiedPill}>
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="location" size={14} color={AuthColors.danger} />
          <Text style={styles.metaText}>
            {facility.address ?? 'Address unavailable'} · {facility.distanceKm.toFixed(1)} km
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="star" size={14} color={AuthColors.accent} />
          <Text style={styles.metaText}>{(facility.rating ?? 0).toFixed(1)}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={[styles.statusText, isOpen ? styles.statusOpen : styles.statusClosed]}>
            {facility.hoursToday ?? (isOpen ? 'Open' : 'Closed')}
          </Text>
        </View>

        <Pressable
          onPress={() =>
            router.push({
              pathname: '/map',
              params: { lat: String(facility.lat), lng: String(facility.lng), name: facility.name },
            })
          }
          accessibilityRole="button"
          accessibilityLabel={`View ${facility.name} on the map`}
          style={({ pressed }) => [styles.mapButton, pressed && styles.pressed]}>
          <Text style={styles.mapButtonText}>🗺️ View on Map</Text>
        </Pressable>

        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const selected = tab === activeTab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${tab} tab`}
                style={styles.tabButton}>
                <Text style={[styles.tabButtonText, selected && styles.tabButtonTextSelected]}>{tab}</Text>
                {selected && <View style={styles.tabUnderline} />}
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'Services' && <ServicesTab services={facility.services ?? []} />}
        {activeTab === 'Doctors' && <DoctorsTab doctors={facility.doctors ?? []} />}
        {activeTab === 'Hours' && <HoursTab hours={facility.hours ?? []} />}
      </ScrollView>

      <BookAppointmentBar facility={facility} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AuthColors.background,
  },
  banner: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerBack: {
    position: 'absolute',
    left: Spacing.three,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  name: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: AuthColors.text,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: AuthColors.success,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  verifiedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: AuthColors.textSecondary,
  },
  dot: {
    color: AuthColors.textSecondary,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusOpen: {
    color: AuthColors.success,
  },
  statusClosed: {
    color: AuthColors.danger,
  },
  mapButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapButtonText: {
    color: AuthColors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AuthColors.border,
  },
  tabButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: AuthColors.textSecondary,
  },
  tabButtonTextSelected: {
    color: AuthColors.primary,
    fontWeight: '700',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: -1,
    height: 2,
    width: '60%',
    borderRadius: 1,
    backgroundColor: AuthColors.primary,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    backgroundColor: '#EEF2F7',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: AuthColors.text,
  },
  doctorList: {
    gap: 0,
  },
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AuthColors.border,
  },
  doctorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AuthColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  doctorText: {
    gap: 2,
  },
  doctorName: {
    fontSize: 14,
    fontWeight: '600',
    color: AuthColors.text,
  },
  doctorSpecialty: {
    fontSize: 13,
    color: AuthColors.textSecondary,
  },
  hoursList: {
    gap: 0,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  hoursDay: {
    fontSize: 14,
    color: AuthColors.text,
  },
  hoursTime: {
    fontSize: 14,
    color: AuthColors.textSecondary,
  },
  hoursDayToday: {
    fontWeight: '700',
    color: AuthColors.primary,
  },
  hoursClosed: {
    color: AuthColors.danger,
  },
  emptyTab: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
  },
  emptyTabText: {
    fontSize: 13,
    color: AuthColors.textSecondary,
  },
  bottomBar: {
    backgroundColor: AuthColors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AuthColors.border,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  bookButton: {
    minHeight: 44,
    backgroundColor: AuthColors.primary,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
  },
  bookButtonText: {
    color: AuthColors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  errorSafeArea: {
    flex: 1,
  },
  errorBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  errorIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: AuthColors.dangerBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AuthColors.text,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    color: AuthColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorButton: {
    minHeight: 44,
    backgroundColor: AuthColors.primary,
    borderRadius: 999,
    paddingHorizontal: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorButtonText: {
    color: AuthColors.onPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});
