import { StyleSheet, View } from 'react-native';

import { Caption, DrinkDrawingFor, DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, radius, space } from '@/constants/tokens';

/**
 * The menu on now, as a card at the top of Drinks (Prod-drinks): "On now ·
 * since 1 Oct", its name in the display face, "8 drinks · Winter on 1 Dec",
 * and three of its drawings on the right. Opens the menu.
 */
export function OnNowCard({ name, since, line, ids, onPress }: { name: string; since: string | null; line: string; ids: readonly string[]; onPress: () => void }) {
  const ds = useDs();
  const eyebrow = ['On now', since].filter(Boolean).join(' · ');
  return (
    <PressableScale role="link" accessibilityLabel={`${name}, ${eyebrow}. ${line}`} onPress={onPress} style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View style={styles.text}>
        <Caption tone="muted" style={styles.caps}>
          {eyebrow}
        </Caption>
        <View style={styles.name}>
          <DsText variant="title" numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular, flexShrink: 1 }}>
            {name}
          </DsText>
          <IconSymbol name="chevron.right" size={16} color={ds.c.ink} />
        </View>
        <Caption tone="muted">{line}</Caption>
      </View>
      <View style={styles.trio} pointerEvents="none">
        {ids.slice(0, 3).map((id, i) => (
          <View key={id} style={[styles.pic, i === 1 && styles.mid]}>
            <DrinkDrawingFor itemId={id} size="row" bare />
          </View>
        ))}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, padding: space.lg, minHeight: 120, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  text: { flex: 1, minWidth: 0, gap: space.xs },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2 },
  name: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 },
  trio: { flexDirection: 'row', alignItems: 'flex-end', flexShrink: 0 },
  pic: { marginLeft: -space.lg },
  mid: { marginBottom: space.md },
});
