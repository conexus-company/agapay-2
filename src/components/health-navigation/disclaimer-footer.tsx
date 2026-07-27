import { StyleSheet, Text } from 'react-native';

import { AuthColors } from '@/constants/auth-theme';
import { Spacing } from '@/constants/theme';

export function DisclaimerFooter() {
  return (
    <Text style={styles.text}>
      AGAPAY provides navigation guidance and does not replace professional medical advice.
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    color: AuthColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: Spacing.three,
  },
});
