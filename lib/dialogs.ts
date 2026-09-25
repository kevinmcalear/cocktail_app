import { Alert, type AlertButton, type AlertOptions, Platform } from 'react-native';

import { useDialogStore } from '@/store/useDialogStore';

/**
 * React Native Web's Alert.alert does nothing, which silently broke every
 * confirmation and error message on the web app. On web, route it to the
 * in-app DialogHost instead, so existing Alert.alert calls (with any number of
 * buttons) work unchanged. Call once at startup.
 */
export function installWebAlert(): void {
  if (Platform.OS !== 'web') return;
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => {
    useDialogStore.getState().show({
      title,
      message,
      buttons: buttons?.length ? buttons : [{ text: 'OK' }],
      onDismiss: options?.onDismiss,
    });
  };
}

/** Shows a message with a single OK button. */
export function showMessage(title: string, message: string): void {
  Alert.alert(title, message);
}

/** Asks a yes/no question; resolves true only if the user confirms. */
export function confirmAsync({
  title,
  message,
  confirmText = 'OK',
  destructive = false,
}: {
  title: string;
  message: string;
  confirmText?: string;
  destructive?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

/** Resolves true when there is nothing to lose, or the user agrees to discard unsaved edits. */
export function confirmDiscardChanges(isDirty: boolean | undefined): Promise<boolean> {
  if (!isDirty) return Promise.resolve(true);
  return confirmAsync({
    title: 'Discard changes?',
    message: 'Your unsaved edits will be lost.',
    confirmText: 'Discard',
    destructive: true,
  });
}
