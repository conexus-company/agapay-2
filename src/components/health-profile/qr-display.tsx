import QRCode from 'react-native-qrcode-svg';
import { StyleSheet, View } from 'react-native';

export function QrDisplay({ value, size = 220 }: { value: string; size?: number }) {
  return (
    <View
      style={styles.wrapper}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Digital Health ID QR code">
      <QRCode value={value} size={size} backgroundColor="#FFFFFF" color="#111827" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
  },
});
