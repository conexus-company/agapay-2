import { useCallback, useRef, useState } from 'react';

const EMERGENCY_KEYWORDS = [
  'chest pain',
  'difficulty breathing',
  'severe bleeding',
  'unconscious',
  'stroke',
  'heart attack',
];

const pattern = new RegExp(EMERGENCY_KEYWORDS.join('|'), 'i');

export function useEmergencyDetection() {
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const shownRef = useRef(false);

  const check = useCallback((text: string) => {
    if (shownRef.current) return false;

    if (pattern.test(text)) {
      shownRef.current = true;
      setShowEmergencyModal(true);
      return true;
    }

    return false;
  }, []);

  const dismiss = useCallback(() => {
    setShowEmergencyModal(false);
  }, []);

  const reset = useCallback(() => {
    shownRef.current = false;
    setShowEmergencyModal(false);
  }, []);

  return { check, dismiss, reset, showEmergencyModal };
}
