import { useRouter, type Href } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Body, Surface, TextLink } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useLineage } from '@/hooks/useLineage';
import { useSpecMatches } from '@/hooks/useSpecMatches';
import { specNoteText } from '@/lib/servedAt';

/**
 * On a bar's version of a catalog classic: what it is, and the way to the
 * classic. "The classic Boulevardier, as poured at The Gold Room." "A variation
 * of the Boulevardier: uses Rye Whiskey, not Bourbon." Nothing for a riff
 * (its family tree says so) or before the verdict loads.
 */
export function ClassicNote({ itemId }: { itemId: string }) {
  const router = useRouter();
  const { data } = useLineage(itemId);
  const drink = data?.drink;
  const classic = drink?.riff_of_id ? data?.ancestors.find((a) => a.id === drink.riff_of_id) : undefined;
  const { data: matches } = useSpecMatches(itemId, classic?.is_catalog ? [itemId] : []);
  const match = matches?.[itemId];
  if (!drink || !classic?.is_catalog || !match || match.spec_match === 'riff') return null;
  const bar = drink.origin_bar?.display_name;
  const note = specNoteText(match.notes);
  const text =
    match.spec_match === 'variation'
      ? `A variation of the ${classic.name}${note ? `: ${note}` : ''}.`
      : match.spec_match === 'same'
        ? `The classic ${classic.name}${bar ? `, as poured at ${bar}` : ''}.`
        : `${bar ?? 'This bar'} pours the ${classic.name}. Its own spec isn't listed here.`;
  return (
    <Surface raised style={styles.note}>
      <Body>{text}</Body>
      <TextLink label={`See the ${classic.name}`} onPress={() => router.push(`/cocktail/${classic.id}` as Href)} />
    </Surface>
  );
}

const styles = StyleSheet.create({
  note: { gap: space.xs },
});
