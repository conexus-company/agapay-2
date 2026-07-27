import { Ionicons } from '@expo/vector-icons';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

const TAB_ICONS = {
  home: { outline: 'home-outline', filled: 'home' },
  map: { outline: 'location-outline', filled: 'location' },
  queue: { outline: 'list-outline', filled: 'list' },
  alerts: { outline: 'notifications-outline', filled: 'notifications' },
  profile: { outline: 'person-outline', filled: 'person' },
} as const satisfies Record<string, { outline: keyof typeof Ionicons.glyphMap; filled: keyof typeof Ionicons.glyphMap }>;

function tabIconSrc(icons: { outline: keyof typeof Ionicons.glyphMap; filled: keyof typeof Ionicons.glyphMap }) {
  return {
    default: <NativeTabs.Trigger.VectorIcon family={Ionicons} name={icons.outline} />,
    selected: <NativeTabs.Trigger.VectorIcon family={Ionicons} name={icons.filled} />,
  };
}

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={tabIconSrc(TAB_ICONS.home)} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="map">
        <NativeTabs.Trigger.Label>Map</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={tabIconSrc(TAB_ICONS.map)} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="queue">
        <NativeTabs.Trigger.Label>Queue</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={tabIconSrc(TAB_ICONS.queue)} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="alerts">
        <NativeTabs.Trigger.Label>Alerts</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={tabIconSrc(TAB_ICONS.alerts)} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={tabIconSrc(TAB_ICONS.profile)} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
