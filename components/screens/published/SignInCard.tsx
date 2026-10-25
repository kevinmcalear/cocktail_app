import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Headline, Surface } from '@/components/ds';
import { space } from '@/constants/tokens';

/**
 * What a signed-out visitor sees where the rest of a page would be: a line on
 * what's behind it, and the ways in. replace: sign-in takes this page's place
 * (it opens again after signing in, so it isn't left behind as a copy).
 */
export function SignInCard({ title = 'Want to see more?', text, replace = false }: { title?: string; text: string; replace?: boolean }) {
  const router = useRouter();
  return (
    <Surface style={styles.card}>
      <Headline role="heading">{title}</Headline>
      <Body tone="muted">{text}</Body>
      <View style={styles.actions}>
        <Button label="Sign in" onPress={() => (replace ? router.replace('/auth/login') : router.push('/auth/login'))} />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, padding: space.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
});
