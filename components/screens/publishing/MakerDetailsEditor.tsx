import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Chip, Field, Headline } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useSaveMakerDetails } from '@/hooks/useMakers';
import { MAKES, makesLine, parseCities, type Makes } from '@/lib/makers';

const LABEL: Record<Makes, string> = { bottles: 'Bottles', ice: 'Ice', garnish: 'Garnish', glassware: 'Glassware', barware: 'Barware', equipment: 'Equipment' };

/**
 * A maker page's own details: what it makes and the cities it serves. On the
 * Publishing screen for whoever can publish for the venue that owns it.
 */
export function MakerDetailsEditor({ profileId, makes: initialMakes, serves: initialServes }: { profileId: string; makes: string[]; serves: string[] }) {
  const save = useSaveMakerDetails(profileId);
  const [makes, setMakes] = useState<string[]>(initialMakes);
  const [serves, setServes] = useState(initialServes.join(', '));
  const [saved, setSaved] = useState(false);
  const toggle = (m: Makes) => {
    setSaved(false);
    setMakes((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : MAKES.filter((x) => x === m || cur.includes(x))));
  };

  return (
    <View style={styles.stack}>
      <Headline role="heading">What you make</Headline>
      <Caption tone="muted">{makes.length ? `On your page: ${makesLine(makes)}.` : 'Pick at least one, so bars can find you.'}</Caption>
      <View role="group" aria-label="What you make" style={styles.chips}>
        {MAKES.map((m) => (
          <Chip key={m} multi label={LABEL[m]} selected={makes.includes(m)} disabled={save.isPending} onPress={() => toggle(m)} />
        ))}
      </View>
      <Field
        label="Cities you serve"
        value={serves}
        onChangeText={(next) => {
          setServes(next);
          setSaved(false);
        }}
        hint={saved ? 'Saved. It shows on your page.' : 'Optional. Separate them with commas, like London, Paris.'}
        error={save.error ? 'Couldn’t save. Check your connection and try again.' : undefined}
        autoCorrect={false}
        maxLength={2000}
      />
      <Button
        label="Save details"
        variant="secondary"
        disabled={save.isPending || !makes.length}
        onPress={() => {
          const cities = parseCities(serves);
          save.mutate(
            { makes, serves: cities },
            {
              onSuccess: () => {
                setServes(cities.join(', '));
                setSaved(true);
              },
            }
          );
        }}
        style={styles.start}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  start: { alignSelf: 'flex-start' },
});
