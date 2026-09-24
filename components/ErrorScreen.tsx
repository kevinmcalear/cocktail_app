import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { reportError } from '@/lib/monitoring';

/**
 * Shown instead of a blank screen when rendering throws. Exported as the root
 * layout's ErrorBoundary, so it renders outside the app's providers and uses
 * plain React Native styling only.
 */
export function ErrorScreen({ error, retry }: ErrorBoundaryProps) {
  const dark = useColorScheme() === 'dark';

  useEffect(() => {
    reportError(error, { boundary: 'root' });
  }, [error]);

  const colors = dark
    ? { background: '#161618', text: '#F2F2F7', muted: '#A1A1AA', button: '#F2F2F7', buttonText: '#161618' }
    : { background: '#F9F9FB', text: '#1C1C1E', muted: '#636366', button: '#1C1C1E', buttonText: '#FFFFFF' };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        Something went wrong
      </Text>
      <Text style={[styles.body, { color: colors.muted }]}>
        The app hit an unexpected error. Your saved work is safe. Try again, and if it keeps happening, restart the
        app.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={retry}
        style={({ pressed }) => [styles.button, { backgroundColor: colors.button, opacity: pressed ? 0.8 : 1 }]}
      >
        <Text style={[styles.buttonText, { color: colors.buttonText }]}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 360 },
  button: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
