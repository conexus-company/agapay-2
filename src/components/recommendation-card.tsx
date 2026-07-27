import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Recommendation } from '@/lib/ai/recommendation';

const URGENCY_STYLES: Record<Recommendation['urgency'], { bg: string; text: string; label: string }> = {
  emergency: { bg: '#FEE2E2', text: '#DC2626', label: 'Emergency' },
  urgent: { bg: '#FEF3C7', text: '#D97706', label: 'Urgent' },
  routine: { bg: '#F0F4F8', text: '#64748B', label: 'Routine' },
};

const ACTION_LABELS: Record<Recommendation['action'], string> = {
  find_facilities: 'Find Facilities',
  call_hotline: 'Call Hotline',
  book_now: 'Book Now',
};

const ACTION_URL = (action: Recommendation['action']): string | null => {
  if (action === 'call_hotline') return 'tel:911';
  return null;
};

type Props = {
  recommendation: Recommendation;
  onActionPress: (rec: Recommendation) => void;
};

export function RecommendationCard({ recommendation, onActionPress }: Props) {
  const { service, reason, action, urgency, department } = recommendation;
  const urgencyStyle = URGENCY_STYLES[urgency];
  const url = ACTION_URL(action);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.badge, { backgroundColor: urgencyStyle.bg }]}>
          <Text style={[styles.badgeText, { color: urgencyStyle.text }]}>{urgencyStyle.label}</Text>
        </View>
        {department && (
          <Text style={styles.department}>{department}</Text>
        )}
      </View>

      <Text style={styles.cardTitle}>{service}</Text>
      <Text style={styles.cardReason}>{reason}</Text>

      {url ? (
        <Pressable
          onPress={() => Linking.openURL(url)}
          style={({ pressed }) => [styles.cardButton, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={ACTION_LABELS[action]}>
          <Text style={styles.cardButtonText}>{ACTION_LABELS[action]}</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => onActionPress(recommendation)}
          style={({ pressed }) => [styles.cardButton, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={ACTION_LABELS[action]}>
          <Text style={styles.cardButtonText}>{ACTION_LABELS[action]}</Text>
        </Pressable>
      )}
    </View>
  );
}

type EmergencyModalProps = {
  visible: boolean;
  onDismiss: () => void;
  onContinue: () => void;
};

export function EmergencyModal({ visible, onDismiss, onContinue }: EmergencyModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Is this an emergency?</Text>
          <Text style={styles.modalBody}>
            If you are experiencing a life-threatening situation, please call 911 or go to the
            nearest emergency room immediately.
          </Text>
          <View style={styles.modalActions}>
            <Pressable
              onPress={() => Linking.openURL('tel:911')}
              style={({ pressed }) => [styles.modalButton, styles.modalCallButton, pressed && { opacity: 0.85 }]}>
              <Text style={styles.modalCallButtonText}>Call 911</Text>
            </Pressable>
            <Pressable
              onPress={onContinue}
              style={({ pressed }) => [styles.modalButton, styles.modalContinueButton, pressed && { opacity: 0.85 }]}>
              <Text style={styles.modalContinueButtonText}>Continue with AI Guidance</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E6EC',
    padding: 16,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  department: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
    color: '#1E293B',
  },
  cardReason: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
  },
  cardButton: {
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: '#F0F0F3',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 4,
  },
  cardButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    gap: 16,
    maxWidth: 400,
    width: '100%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#DC2626',
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
    textAlign: 'center',
  },
  modalActions: {
    gap: 10,
  },
  modalButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCallButton: {
    backgroundColor: '#DC2626',
  },
  modalCallButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContinueButton: {
    backgroundColor: '#F0F0F3',
  },
  modalContinueButtonText: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '600',
  },
});
