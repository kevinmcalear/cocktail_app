import { StyleSheet, View } from 'react-native';

import { Body, Caption, Spec, Tag, Title, useDs } from '@/components/ds';
import { radius, space, type } from '@/constants/tokens';
import { serviceStyleLabel, type StationCard as Card } from '@/lib/service';

/**
 * One drink on the station sheet, readable at arm's length: the name, how
 * it's served, the pour from the batch, what's added and the garnish.
 */
export function StationCard({ card }: { card: Card }) {
  const ds = useDs();
  const style = serviceStyleLabel(card.style);
  const spoken = [card.name, style, card.how, card.pour, ...card.adds.map((a) => `add ${a}`), card.garnish.length ? `garnish ${card.garnish.join(', ')}` : null]
    .filter(Boolean)
    .join('. ');
  return (
    <View accessible accessibilityLabel={spoken} role="listitem" style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View style={styles.head}>
        <Title numberOfLines={2} style={styles.name}>
          {card.name}
        </Title>
        {style ? <Tag label={style} tone="accent" /> : null}
      </View>
      {card.how ? <Caption tone="muted">{card.how}</Caption> : null}
      <View style={styles.lines}>
        {card.pour ? (
          <Spec tone="accent" style={styles.pour}>
            {card.pour}
          </Spec>
        ) : null}
        {card.adds.map((a) => (
          <Body key={a}>+ {a}</Body>
        ))}
        {!card.pour && !card.adds.length ? <Body tone="muted">No measured spec yet.</Body> : null}
      </View>
      {card.garnish.length ? <Caption tone="muted">Garnish: {card.garnish.join(', ')}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1, padding: space.lg, gap: space.sm, flexGrow: 1 },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.sm },
  name: { flex: 1 },
  lines: { gap: space.xs, marginTop: space.xs },
  // A size up from spec, so the pour reads from a step back.
  pour: { fontSize: type.headline.fontSize + space.xs, lineHeight: type.headline.lineHeight + space.xs },
});
