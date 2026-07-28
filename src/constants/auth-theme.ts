export const AuthColors = {
  background: '#F5F7FA',
  surface: '#FFFFFF',
  border: '#E2E6EC',
  /** Sampled from the AGAPAY wordmark (assets/images/logo.png). */
  primary: '#3764A7',
  primaryPressed: '#2C5286',
  /** Text/icon color for content placed on top of the primary blue (e.g. CTA labels). */
  onPrimary: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
  /** Sampled from the logo's "A" accent — matches the brand mark instead of a generic UI red. */
  danger: '#B5252A',
  dangerBackground: '#F6E5E5',
  success: '#059669',
  /** Sampled from the logo's "A" accent (gold). Decorative/graphical use only — not for body text on light backgrounds. */
  accent: '#FDD02D',
  /** Text/icon color for content placed on top of the accent yellow. */
  onAccent: '#111827',
} as const;
