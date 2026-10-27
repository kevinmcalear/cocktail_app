import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { joinStep, partSentence, type PartJoin } from '@/lib/drinkParts';
import type { DatabaseItem } from '@/types/types';

/**
 * A drink made in parts (canvas Q20b, frame 4): the parts in order, each
 * with its name, how it's made, its lines and how it joins. "1 The coffee.
 * Build in the glass: Irish whiskey, Hot coffee." Nothing for a drink in one part.
 */
export function DrinkParts({ item }: { item: DatabaseItem }) {
  const parts = item.madeInParts;
  if (!parts?.length) return null;
  const methods = [...(item.item_methods ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return (
    <PartsList
      parts={parts.map((p, i) => {
        const lines = (item.recipes ?? []).filter((r) => r.part === i + 1).flatMap((r) => (r.ingredient?.name ? [r.ingredient.name] : []));
        const how = methods.filter((m) => m.part === i + 1).flatMap((m) => (m.method?.name ? [m.method.name] : []));
        return { name: p.name, text: partSentence(how, lines, i > 0 ? p.join : null) };
      })}
    />
  );
}

/** The parts as numbered rows, each its name and its sentence: the drink page's look, the public page's too. */
export function PartsList({ parts }: { parts: { name: string; text: string }[] }) {
  return (
    <View style={styles.stack}>
      <Caption tone="muted" style={styles.label}>
        Method
      </Caption>
      <View role="list" aria-label="Made in parts" style={styles.stack}>
        {parts.map((p, i) => (
          <View key={i} role="listitem" style={styles.row}>
            <PartNumber n={i + 1} />
            <Body style={styles.flex}>
              <Body style={styles.name}>{`${p.name}. `}</Body>
              {p.text}
            </Body>
          </View>
        ))}
      </View>
    </View>
  );
}

/** A part's head where the drink is made (board made-parts-making): its number, an eyebrow ("PART 1 OF 2"), its name and how it's made. */
export function PartHead({ n, name, how, eyebrow }: { n: number; name: string; how?: string | null; eyebrow?: string }) {
  const ds = useDs();
  return (
    <View role="heading" aria-level={3} style={styles.head}>
      <PartNumber n={n} />
      <View style={styles.flex}>
        {eyebrow ? <Caption color={ds.accentText} style={styles.label}>{eyebrow}</Caption> : null}
        <Body style={styles.strong}>{name}</Body>
        {how ? <Caption tone="muted">{how}</Caption> : null}
      </View>
    </View>
  );
}

/** A part's join as its last line: "Then float it on top", after an arrow that sits where the amounts do. */
export function JoinLine({ join, inset }: { join: PartJoin | null; inset: number }) {
  const ds = useDs();
  const step = joinStep(join);
  if (!step) return null;
  return (
    <View accessible accessibilityLabel={`Then ${step.toLowerCase()}`} style={styles.join}>
      <View style={{ width: inset }}>
        <IconSymbol name={join === 'float' ? 'arrow.up' : 'arrow.turn.down.right'} size={20} color={ds.accentText} />
      </View>
      <Body style={[styles.flex, styles.name]}>{`Then ${step.toLowerCase()}`}</Body>
    </View>
  );
}

function PartNumber({ n }: { n: number }) {
  const ds = useDs();
  return (
    <View style={[styles.number, { backgroundColor: ds.accentFill.fill }]}>
      <DsText variant="caption" color={ds.accentFill.text}>
        {String(n)}
      </DsText>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingTop: space.md, paddingBottom: space.xs },
  join: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  stack: { gap: space.sm },
  label: { fontFamily: fontFamilies.mono, letterSpacing: 1.2, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  number: { width: 24, height: 24, marginTop: 1, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fontFamilies.bodyMedium },
  flex: { flex: 1 },
});
