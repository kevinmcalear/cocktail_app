import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, EquipmentDrawing, Headline, IngredientDrawing, MatchText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Eyebrow } from '@/components/screens/addDrink/WizardChrome';
import { layout, radius, space } from '@/constants/tokens';
import type { FoundItem } from '@/hooks/useHomeBar';
import { useKit } from '@/hooks/useKit';
import { foundLine } from '@/lib/myBarText';
import { EQUIPMENT, EQUIPMENT_KINDS } from '@/lib/techniques';

import { BarTile, TileGrid } from './BarTile';

// The pieces of Add to your bar (AddToBarSheet): an idea tile, a typed
// result, a prep's recipe link, the snap row, and the kit list.

/** A house prep's recipe, to make it. */
export function RecipeLink({ name, onPress }: { name: string; onPress: () => void }) {
  return (
    <PressableScale role="link" accessibilityLabel={`${name} recipe`} onPress={onPress} style={styles.recipe}>
      <Caption tone="accent">Recipe</Caption>
    </PressableScale>
  );
}

/** An idea to tick: on your bar shows a ring and a check. */
export function IdeaTile({ item, has, onToggle }: { item: FoundItem; has: boolean; onToggle: (item: FoundItem, add: boolean) => void }) {
  const onLine = item.section === 'preps' ? 'In your fridge' : 'On your bar';
  return (
    <BarTile
      name={item.name}
      meta={has ? onLine : foundLine(item)}
      metaTone={has ? 'accent' : 'muted'}
      picture={<IngredientDrawing id={item.id} name={item.name} lazy />}
      role="checkbox"
      checked={has}
      accessibilityLabel={item.name}
      accessibilityHint={has ? 'Takes it off your bar' : 'Puts it on your bar'}
      badge={has ? 'check' : 'plus'}
      onPress={() => onToggle(item, !has)}
    />
  );
}

/** A typed result you tick to have: the drawing, the name, and a check or a plus. */
export function Result({ name, sub, query, thumb, has, onToggle, extra }: { name: string; sub?: string; query?: string; thumb?: ReactNode; has: boolean; onToggle: (on: boolean) => void; extra?: ReactNode }) {
  const ds = useDs();
  return (
    <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <PressableScale role="checkbox" aria-checked={has} accessibilityLabel={name} accessibilityHint={has ? 'Takes it off your bar' : 'Puts it on your bar'} onPress={() => onToggle(!has)} style={styles.rowMain}>
        {thumb}
        <View style={styles.name}>
          <Headline numberOfLines={1}>
            <MatchText text={name} query={query} look="tint" />
          </Headline>
          {sub ? <Caption tone={has ? 'accent' : 'muted'}>{sub}</Caption> : null}
        </View>
        <IconSymbol name={has ? 'checkmark.circle.fill' : 'plus.circle'} size={26} color={has ? ds.accentText : ds.c.muted} />
      </PressableScale>
      {extra}
    </View>
  );
}

/** At the end of typed results: snap the bottle instead. */
export function SnapRow({ onSnap }: { onSnap: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel="Snap the bottle" onPress={onSnap} style={styles.rowMain}>
      <View style={[styles.snapIcon, { borderColor: ds.c.lineStrong }]}>
        <IconSymbol name="camera.fill" size={20} color={ds.c.ink} />
      </View>
      <Body tone="muted" style={styles.name}>
        Not here? Snap the bottle and we’ll find it.
      </Body>
    </PressableScale>
  );
}

/** The equipment list as tiles by kind, searched by name: what you tick here is your kit. */
export function KitResults({ query, cols }: { query: string; cols: number }) {
  const { owned, toggle } = useKit();
  const q = query.toLowerCase();
  const list = q ? EQUIPMENT.filter((e) => `${e.name} ${e.what}`.toLowerCase().includes(q)) : EQUIPMENT;
  if (!list.length) return <Body tone="muted">{`No kit called “${query}”.`}</Body>;
  return EQUIPMENT_KINDS.flatMap((kind) => {
    const pieces = list.filter((e) => e.kind === kind.id);
    if (!pieces.length) return [];
    return [
      <View key={kind.id} style={styles.group}>
        <View style={styles.heading}>
          <Eyebrow>{kind.name}</Eyebrow>
        </View>
        <TileGrid cols={cols}>
          {pieces.map((e) => {
            const has = owned.includes(e.id);
            return (
              <BarTile
                key={e.id}
                name={e.name}
                meta={has ? 'You have it' : null}
                metaTone="accent"
                picture={<EquipmentDrawing id={e.id} lazy />}
                role="checkbox"
                checked={has}
                accessibilityLabel={e.name}
                accessibilityHint={e.what}
                badge={has ? 'check' : 'plus'}
                onPress={() => toggle(e.id)}
              />
            );
          })}
        </TileGrid>
      </View>,
    ];
  });
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  heading: { paddingTop: space.md },
  recipe: { alignSelf: 'flex-start', minHeight: layout.minTapTarget, justifyContent: 'center' },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: space.xs },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingVertical: space.sm },
  name: { flex: 1, gap: 2 },
  snapIcon: { width: 48, height: 48, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
});
