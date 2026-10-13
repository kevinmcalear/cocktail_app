import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { fontFamilies, space } from '@/constants/tokens';

import type { Fact } from './DrinkFacts';

/**
 * Method, glass, ice and garnish in one quiet line under the spec, so the
 * spec and how to finish it read as one recipe (13 Oct: everything on the
 * first screen is what you need to make the drink). Glass and ice open the
 * glass sheet (its size and the ice per serve) when this role sees amounts.
 */
export function MakeLine({ facts }: { facts: Fact[] }) {
  const ds = useDs();
  if (!facts.length) return null;
  return (
    <View style={[styles.line, { borderColor: ds.c.line }]} role="list">
      {facts.map((f) => {
        const Cell = f.onPress ? PressableScale : View;
        return (
          <Cell
            key={f.label}
            role={f.onPress ? 'button' : 'listitem'}
            accessibilityLabel={`${f.label}: ${f.value}${f.sub ? `, ${f.sub}` : ''}`}
            accessibilityHint={f.accessibilityHint}
            onPress={f.onPress}
            style={styles.cell}
          >
            <Caption tone="muted" style={styles.label}>
              {f.label}
            </Caption>
            <DsText variant="label" numberOfLines={2} style={f.onPress ? [styles.value, styles.tappable, { textDecorationColor: ds.c.lineStrong }] : styles.value}>
              {f.value}
            </DsText>
            {f.sub ? (
              <Caption tone="muted" numberOfLines={1}>
                {f.sub}
              </Caption>
            ) : null}
          </Cell>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // The spec's last row draws the line above.
  line: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: space.md, paddingBottom: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  // Four to a phone row; a long glass name wraps to two lines rather than pushing the row wider.
  cell: { flexGrow: 1, flexBasis: 64, minWidth: 64, maxWidth: '50%', gap: 2 },
  label: { fontFamily: fontFamilies.mono, letterSpacing: 1.2, textTransform: 'uppercase' },
  value: { fontFamily: fontFamilies.bodyMedium },
  tappable: { textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
});
