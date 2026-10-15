import { Stack, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ds';
import { SafetyPage } from '@/components/screens/safety/SafetyPage';
import { space } from '@/constants/tokens';

/** A link that goes nowhere: the same plain page as Not available, with a way home. */
export default function NotFound() {
  const router = useRouter();
  return (
    <SafetyPage title="Page not found" intro="This link doesn’t go anywhere. It may be old, or the drink or menu may have been removed." backTo="/">
      <Stack.Screen options={{ headerShown: false, title: 'Not found' }} />
      <View style={styles.actions}>
        <Button label="Go to home" onPress={() => router.replace('/')} />
      </View>
    </SafetyPage>
  );
}

const styles = StyleSheet.create({
  actions: { alignItems: 'flex-start', marginTop: space.md },
});
