/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/**
 * Brand design tokens used across the AGAPAY screens (discovery, booking,
 * queue). Values are aligned with the AuthColors palette so light-mode UI
 * stays visually consistent.
 */
export const Brand = {
  background: '#F5F7FA',
  surface: '#FFFFFF',
  border: '#E2E6EC',
  primary: '#3764A7',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  muted: '#9CA3AF',
  mutedBg: '#EEF2F7',
  mutedText: '#6B7280',
  danger: '#B5252A',
  dangerBg: '#F6E5E5',
  dangerText: '#B5252A',
  warning: '#B45309',
  warningBg: '#FEF3C7',
  infoBg: '#DBEAFE',
  infoText: '#1D4ED8',
  successBg: '#D1FAE5',
  successText: '#047857',
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80, web: 64 }) ?? 0;
export const MaxContentWidth = 800;
