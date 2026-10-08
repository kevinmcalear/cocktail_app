import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Headline, Surface } from '@/components/ds';
import { space } from '@/constants/tokens';

/**
 * What a signed-out visitor sees where the rest of a page would be: a line on
 * what's behind it, and the ways in.
 */
export function SignInCard({ title = 'Want to see more?', text }: { title?: string; text: string }) {
  const router = useRouter();
  return (
    <Surface style={styles.card}>
      <Headline role="heading">{title}</Headline>
      <Body tone="muted">{text}</Body>
      <View style={styles.actions}>
        <Button label="Sign in" onPress={() => router.push('/auth/login')} />
        <Button label="Create an account" variant="ghost" onPress={() => router.push('/auth/sign-up')} />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, padding: space.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
});
