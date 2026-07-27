import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthColors } from '@/constants/auth-theme';
import { Spacing } from '@/constants/theme';

// UI for the emergency short-circuit path (spec called this out as "not
// shown in the reference screenshots — confirm with your team"). Built as a
// standalone red alert card that replaces the normal "Best Match" card, per
// the requirement that emergency input must never render as a routine
// recommendation.
export function EmergencyBanner() {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="warning" size={24} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>This may be a medical emergency</Text>
      </View>
      <Text style={styles.body}>
        Based on what you described, please seek immediate medical attention. If you or someone with you is
        experiencing a life-threatening emergency, call 911 now.
      </Text>
      <Pressable
        onPress={() => Linking.openURL('tel:911')}
        accessibilityRole="button"
        accessibilityLabel="Call 911 emergency hotline"
        style={({ pressed }) => [styles.callButton, pressed && styles.pressed]}>
        <Ionicons name="call" size={18} color="#FFFFFF" />
        <Text style={styles.callButtonText}>Call 911</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AuthColors.dangerBackground,
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AuthColors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: AuthColors.danger,
    fontSize: 17,
    fontWeight: '700',
  },
  body: {
    color: AuthColors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: AuthColors.danger,
    borderRadius: 999,
    paddingVertical: Spacing.three,
  },
  pressed: {
    opacity: 0.8,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
