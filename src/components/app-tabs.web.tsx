import { Ionicons } from '@expo/vector-icons';
import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps, TabListProps } from 'expo-router/ui';
import { Pressable, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { AuthColors } from '@/constants/auth-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <BottomTabBar>
          <TabTrigger name="index" href="/" asChild>
            <TabButton icon="home-outline" iconFocused="home" label="Home" />
          </TabTrigger>
          <TabTrigger name="map" href="/map" asChild>
            <TabButton icon="location-outline" iconFocused="location" label="Map" />
          </TabTrigger>
          <TabTrigger name="queue" href="/queue" asChild>
            <TabButton icon="list-outline" iconFocused="list" label="Queue" />
          </TabTrigger>
          <TabTrigger name="alerts" href="/alerts" asChild>
            <TabButton icon="notifications-outline" iconFocused="notifications" label="Alerts" />
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton icon="person-outline" iconFocused="person" label="Profile" />
          </TabTrigger>
        </BottomTabBar>
      </TabList>
    </Tabs>
  );
}

type TabButtonProps = TabTriggerSlotProps & {
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  label: string;
};

export function TabButton({ icon, iconFocused, label, isFocused, ...props }: TabButtonProps) {
  const theme = useTheme();
  const tintColor = isFocused ? AuthColors.primary : theme.textSecondary;

  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <Ionicons name={isFocused ? iconFocused : icon} size={24} color={tintColor} />
      <ThemedText type="small" style={[styles.tabLabel, { color: tintColor }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function BottomTabBar(props: TabListProps) {
  const insets = useSafeAreaInsets();

  return (
    <View {...props} style={[styles.tabListContainer, { paddingBottom: insets.bottom }]}>
      <ThemedView type="background" style={styles.innerContainer}>
        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(120, 120, 128, 0.3)',
  },
  innerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.one,
  },
  tabLabel: {
    fontSize: 12,
    lineHeight: 14,
  },
});
