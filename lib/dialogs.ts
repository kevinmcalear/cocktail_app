import { Alert, Platform } from 'react-native';

// React Native's Alert.alert does nothing in a browser, so every dialog the
// app shows goes through these, which fall back to the browser's own dialogs.

/** Shows a message with a single OK button. */
export function showMessage(title: string, message: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
    return;
  }
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
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`));
  }
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
