import { StyleSheet } from 'react-native';

import { Body, Button, Caption, Surface } from '@/components/ds';
import { space } from '@/constants/tokens';
import type { ServeGuess } from '@/lib/specDefaults';

/**
 * "Shake, coupe, no ice?" with one button for all three: the quick way past
 * method, glass and ice when the guess from the spec is right.
 */
export function ServeGuessCard({ guess, onUse }: { guess: ServeGuess; onUse: () => void }) {
  if (!guess.method || !guess.glass || !guess.ice) return null;
  const all = `${guess.method}, ${guess.glass.toLowerCase()}, ${guess.ice.toLowerCase()}`;
  return (
    <Surface raised style={styles.card}>
      <Caption tone="muted">From the spec</Caption>
      <Body>{`${all}?`}</Body>
      {guess.why ? <Caption tone="muted">{`${guess.why}.`}</Caption> : null}
      <Button label="Use all three" icon="sparkles" variant="secondary" onPress={onUse} accessibilityLabel={`Use ${all}`} style={styles.button} />
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.xs, padding: space.lg },
  button: { alignSelf: 'flex-start', marginTop: space.sm },
});
