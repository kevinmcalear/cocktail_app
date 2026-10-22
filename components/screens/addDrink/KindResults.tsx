import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, IngredientThumb, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import type { WizardPick } from '@/lib/drinkWizard';
import { kindWords } from '@/lib/ingredientNames';

import { Eyebrow } from './WizardChrome';

/** Bottles shown before "See all", as drawn. */
const BRANDS = 4;

interface Row {
  id: string;
  name: string | null;
}

interface KindResultsProps {
  /** The plain ingredient typed: Mezcal. */
  kind: Row;
  /** Its bottles, the ones you have first (lib/ingredientNames bottlesOfKind). */
  bottles: readonly Row[];
  have?: ReadonlySet<string>;
  /** "On your back bar" at a venue, "On your shelf" at home. */
  haveLabel: string;
  onPick: (pick: WizardPick) => void;
}

/**
 * A kind typed in full (canvas eddie-oct22-wave1, fix 7): the plain thing
 * first, to add as it is, then "Pick a brand" for whoever wants one, with
 * what's on the back bar leading and saying so. Many bars don't care about
 * the brand ("this is just the Irish whiskey"), so the brand never comes
 * first.
 */
export function KindResults({ kind, bottles, have, haveLabel, onPick }: KindResultsProps) {
  const ds = useDs();
  const [all, setAll] = useState(false);
  const name = kind.name ?? '';
  const shown = all ? bottles : bottles.slice(0, BRANDS);
  return (
    <View style={styles.stack}>
      <PressableScale
        role="button"
        accessibilityLabel={name}
        accessibilityHint={`Any ${kindWords(name)}, added as it is`}
        onPress={() => onPick({ id: kind.id, name })}
        style={[styles.plain, { backgroundColor: ds.c.surface }]}
      >
        <IngredientThumb id={kind.id} name={name} size={40} />
        <View style={styles.flex}>
          <Body numberOfLines={1} style={styles.strong}>
            {name}
          </Body>
          <Caption tone="muted">{`Any ${kindWords(name)} · add it as it is`}</Caption>
        </View>
        <IconSymbol name="plus" size={18} color={ds.accentText} />
      </PressableScale>
      <View style={styles.brands}>
        <Eyebrow>Pick a brand · optional</Eyebrow>
        <View role="list" aria-label={`Brands of ${kindWords(name)}`}>
          {shown.map((b) => {
            const on = !!have?.has(b.id);
            return (
              <PressableScale
                key={b.id}
                role="button"
                accessibilityLabel={on ? `${b.name}, ${haveLabel.toLowerCase()}` : (b.name ?? '')}
                onPress={() => onPick({ id: b.id, name: b.name ?? name })}
                style={[styles.brand, { borderBottomColor: ds.c.line }]}
              >
                <Body numberOfLines={1} style={styles.flex}>
                  {b.name}
                </Body>
                {on ? <Caption tone="accent">{haveLabel}</Caption> : null}
              </PressableScale>
            );
          })}
          {bottles.length > shown.length ? (
            <PressableScale role="button" onPress={() => setAll(true)} style={styles.all}>
              <Body style={styles.strong}>{`See all ${bottles.length} ${kindWords(name, true)}`}</Body>
            </PressableScale>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  plain: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingHorizontal: space.md, borderRadius: radius.control + space.xs },
  flex: { flex: 1, minWidth: 0 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  brands: { gap: space.xs, paddingTop: space.xs },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth },
  all: { minHeight: layout.minTapTarget + space.xs, justifyContent: 'center' },
});
