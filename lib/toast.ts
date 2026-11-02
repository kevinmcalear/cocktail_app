import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { toast } from '@/lib/systemToast';

/** Non-blocking success confirmation (toast + success haptic on native). */
export function toastDone(title: string, message?: string) {
  toast({ title, message, preset: 'done', haptic: 'none' });
  if (Platform.OS !== 'web') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}
