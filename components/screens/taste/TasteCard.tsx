import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, Headline, PalateFlower, PressableScale, Surface, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { useMyTaste } from '@/hooks/useFlavor';
import { tasteHeadline } from '@/lib/flavor';
import { changeBetween, palateByMonth } from '@/lib/palate';

import { monthName } from './TasteSections';

/** Your palate on You: the flower, what stands out, how it has moved. Opens /taste. */
export function TasteCard() {
  const ds = useDs();
  const router = useRouter();
  const { data: me } = useMyTaste();
  if (!me) return null;
  const headline = tasteHeadline(me.taste);
  const months = palateByMonth(me.entries, me.baseline, me.answers);
  const change = months.length >= 2 ? changeBetween(months[0].taste, months.at(-1)!.taste) : null;
  const n = me.rankedDrinks;
  const line = !headline
    ? 'Tell us what you like and it starts here. Every drink you rank shapes it.'
    : change
      ? `Since ${monthName(months[0].key)}: ${change}.`
      : n
        ? `From the ${n} drink${n === 1 ? '' : 's'} you've ranked${me.answers ? ' and your answers' : ''}.`
        : 'From your answers. Every drink you rank moves it.';
  return (
    <PressableScale role="link" accessibilityLabel={`Your taste. ${headline ?? 'Not set yet'}. ${line}`} onPress={() => router.push('/taste')}>
      <Surface style={styles.card}>
        <PalateFlower values={me.taste} size={104} on={ds.c.surface} />
        <View style={styles.text}>
          <Caption tone="muted" style={styles.kicker}>
            YOUR TASTE
          </Caption>
          <Headline>{headline ? `${headline}.` : 'Not set yet'}</Headline>
          <Caption tone="muted">{line}</Caption>
        </View>
        <IconSymbol name="chevron.right" size={14} color={ds.c.faint} />
      </Surface>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  text: { flex: 1, gap: space.xs },
  kicker: { letterSpacing: 1.3 },
});
