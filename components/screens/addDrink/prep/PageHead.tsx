import { StyleSheet, View } from 'react-native';

import { Caption, DsText, GlassButton, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, font, layout, radius, space, type } from '@/constants/tokens';

import { Trail, type TrailItem } from '../Trail';

/**
 * The top of a house-made written inside a drink (Kept-add-helpers, Writing
 * it, then back): Back, the drink's name, Done; the trail from the drink to
 * it; then its name, a draft inside the drink.
 */
export function PageHead({ trail, drinkName, name, canAdd, onBack, onDone }: { trail: readonly TrailItem[]; drinkName: string; name: string; canAdd: boolean; onBack: () => void; onDone: () => void }) {
  const ds = useDs();
  return (
    <View style={styles.head}>
      <View style={styles.bar}>
        <GlassButton icon="chevron.left" accessibilityLabel={`Back to ${drinkName}. What you’ve done is kept`} onPress={onBack} />
        <DsText numberOfLines={1} tone="muted" style={styles.drink}>
          {drinkName}
        </DsText>
        <PressableScale role="button" accessibilityLabel={`Done: add ${name} to ${drinkName}`} disabled={!canAdd} onPress={onDone} style={[styles.done, { backgroundColor: ds.accentFill.fill, opacity: canAdd ? 1 : 0.45 }]}>
          <IconSymbol name="checkmark" size={20} color={ds.accentFill.text} />
        </PressableScale>
      </View>
      <Trail items={trail} />
      <Caption tone="muted" style={styles.eyebrow}>
        HOUSE-MADE · DRAFT, INSIDE THE DRINK
      </Caption>
      <DsText role="heading" style={[styles.title, { fontFamily: displayFaces[ds.displayFace].regular }]}>
        {name}
      </DsText>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.sm, marginBottom: space.sm },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  drink: { flex: 1, textAlign: 'center', ...font.semiBold },
  done: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { letterSpacing: 0.6, ...font.medium },
  title: { ...type.title },
});
