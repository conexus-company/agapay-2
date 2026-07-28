import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';

import { ComingSoonScreen } from '@/components/coming-soon-screen';

export default function ComingSoonRoute() {
  const { title, subtitle, icon } = useLocalSearchParams<{
    title?: string;
    subtitle?: string;
    icon?: string;
  }>();

  return (
    <ComingSoonScreen
      icon={(icon as keyof typeof Ionicons.glyphMap) ?? 'construct-outline'}
      title={title ?? 'Coming soon'}
      subtitle={subtitle ?? "We're building this feature. Check back soon."}
      showBack
    />
  );
}
