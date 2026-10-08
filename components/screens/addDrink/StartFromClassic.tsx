import { Alert, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Surface } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useDrinkLists } from '@/hooks/useDiscover';
import { useStartFromClassic } from '@/hooks/useStartFromClassic';
import type { ClassicMatch } from '@/lib/classics';
import type { WizardDraft } from '@/lib/drinkWizard';

import { Eyebrow, WizardChip } from './WizardChrome';

/** How many classics the empty spec offers. */
const OFFERED = 6;

interface Props {
  set: (change: Partial<WizardDraft>) => void;
  /** The classic the name already is ("House Negroni" is a Negroni): one card, not a list. */
  match?: ClassicMatch | null;
  onStarted?: () => void;
}

/**
 * A classic's spec as a head start: lines, method, glass, ice and garnish
 * fill in, credited as a version of it, and everything stays editable. With
 * `match`, a card for the classic the name is; otherwise the best-known
 * classics as chips, for an empty spec.
 */
export function StartFromClassic({ set, match, onStarted }: Props) {
  const classics = useDrinkLists().data ?? [];
  const start = useStartFromClassic();
  const go = (id: string) =>
    start.mutate(id, {
      onSuccess: (change) => {
        set(change);
        onStarted?.();
      },
      onError: (e) => Alert.alert('Couldn’t load that spec', e.message),
    });

  if (match) {
    const name = match.classic.name;
    return (
      <Surface raised style={styles.card}>
        <Body>{match.exact ? `${name} is a classic. Start from its spec?` : `A riff on the ${name}? Start from its spec.`}</Body>
        <Caption tone="muted">Fills in what goes in, the method, glass, ice and garnish. Change any of it after.</Caption>
        <Button
          label={start.isPending ? 'Loading…' : `Start from the ${name}`}
          icon="sparkles"
          variant="secondary"
          disabled={start.isPending}
          onPress={() => go(match.classic.id)}
          style={styles.button}
        />
      </Surface>
    );
  }

  if (!classics.length) return null;
  return (
    <View style={styles.stack}>
      <Eyebrow>Or start from a classic</Eyebrow>
      <View role="group" accessibilityLabel="Start from a classic" style={styles.chips}>
        {classics.slice(0, OFFERED).map((c) => (
          <WizardChip key={c.id} label={c.name} kind="button" onPress={() => go(c.id)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, padding: space.lg },
  button: { alignSelf: 'flex-start', marginTop: space.xs },
  stack: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
