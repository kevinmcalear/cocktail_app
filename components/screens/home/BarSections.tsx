import { useRouter } from 'expo-router';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Body, Button, Caption, Chip, Headline, IngredientThumb, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import type { ShelfItem } from '@/hooks/useHomeBar';
import { madeLine, SECTIONS, type BarSection } from '@/lib/barSections';
import { confirmAsync } from '@/lib/dialogs';
import { itemHref } from '@/lib/itemRoutes';
import { equipmentById } from '@/lib/techniques';

export type Jumpable = BarSection | 'kit';

/** A section's title, count and line about what goes in it. */
export function SectionHead({ section, count }: { section: Jumpable; count?: number }) {
  return (
    <View style={styles.head}>
      <View style={styles.title}>
        <Headline role="heading">{SECTIONS[section].title}</Headline>
        {count ? <Caption tone="muted">{count}</Caption> : null}
      </View>
      <Caption tone="muted">{SECTIONS[section].blurb}</Caption>
    </View>
  );
}

/** Shortcuts down a long My Bar: each section with how much is in it. */
export function SectionJump({ counts, onJump }: { counts: [Jumpable, number][]; onJump: (section: Jumpable) => void }) {
  const ds = useDs();
  return (
    <View role="navigation" accessibilityLabel="Sections" style={styles.jump}>
      {counts.map(([section, n]) => (
        <PressableScale key={section} role="link" accessibilityLabel={`${SECTIONS[section].title}, ${n}`} onPress={() => onJump(section)} style={[styles.jumpLink, { backgroundColor: ds.c.surface }]}>
          <Caption>{section === 'fridge' ? 'Fridge' : SECTIONS[section].title}</Caption>
          <Caption tone="muted">{n}</Caption>
        </PressableScale>
      ))}
    </View>
  );
}

const confirmOff = async (item: ShelfItem, onRemove: (id: string) => void) => {
  const ok = await confirmAsync({ title: `Take ${item.name} off your bar?`, message: 'Drinks that need it leave What to make.', confirmText: 'Take off', destructive: true });
  if (ok) onRemove(item.id);
};

/** Acids, enzymes and gums, two to a row. */
export function LabSection({ items, onRemove, style }: { items: ShelfItem[]; onRemove: (id: string) => void; style?: StyleProp<ViewStyle> }) {
  const ds = useDs();
  const router = useRouter();
  return (
    <View style={[styles.section, style]}>
      <SectionHead section="lab" count={items.length} />
      <View style={styles.grid}>
        {items.map((item) => (
          <View key={item.id} style={[styles.tile, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
            <PressableScale role="link" accessibilityLabel={item.name} onPress={() => router.push(itemHref('Ingredient', item.id) as never)} style={styles.tileOpen}>
              <IngredientThumb id={item.id} name={item.name} size={32} />
              <View style={styles.text}>
                <Caption numberOfLines={2}>{item.name}</Caption>
              </View>
            </PressableScale>
            <PressableScale accessibilityLabel={`Take ${item.name} off your bar`} onPress={() => confirmOff(item, onRemove)} style={styles.remove}>
              <IconSymbol name="xmark" size={14} color={ds.c.muted} />
            </PressableScale>
          </View>
        ))}
      </View>
    </View>
  );
}

/** House preps you have: when you made each and what it goes into. */
export function PrepsSection({ items, onRemove, style }: { items: ShelfItem[]; onRemove: (id: string) => void; style?: StyleProp<ViewStyle> }) {
  const ds = useDs();
  const router = useRouter();
  return (
    <View style={[styles.section, style]}>
      <SectionHead section="preps" count={items.length} />
      <View>
        {items.map((item) => {
          const made = madeLine(item.addedAt);
          const used = item.uses ? `In ${item.uses} ${item.uses === 1 ? 'drink' : 'drinks'}` : 'Not used yet';
          return (
            <View key={item.id} style={[styles.row, { borderBottomColor: ds.c.line }]}>
              <PressableScale role="link" accessibilityLabel={[item.name, made, used].filter(Boolean).join(', ')} onPress={() => router.push(itemHref('Ingredient', item.id) as never)} style={styles.open}>
                <IngredientThumb id={item.id} name={item.name} size={44} />
                <View style={styles.text}>
                  <Body numberOfLines={1}>{item.name}</Body>
                  {made ? (
                    <Caption tone="muted" numberOfLines={1}>
                      {made}
                    </Caption>
                  ) : null}
                </View>
                <Caption tone={item.uses ? 'accent' : 'muted'} aria-hidden>
                  {used}
                </Caption>
              </PressableScale>
              <PressableScale accessibilityLabel={`Take ${item.name} off your bar`} onPress={() => confirmOff(item, onRemove)} style={styles.remove}>
                <IconSymbol name="xmark" size={16} color={ds.c.muted} />
              </PressableScale>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** The kit you have, ticked like the fridge: tap one to take it off. */
export function KitSection({ owned, onToggle, onAdd, style }: { owned: readonly string[]; onToggle: (id: string) => void; onAdd: () => void; style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  const kit = owned.flatMap((id) => equipmentById(id) ?? []);
  return (
    <View style={[styles.section, style]}>
      <SectionHead section="kit" count={kit.length} />
      <View role="group" accessibilityLabel="Kit" style={styles.chips}>
        {kit.map((e) => (
          <Chip key={e.id} label={e.name} multi quiet selected onPress={() => onToggle(e.id)} />
        ))}
        <Button label="Add kit" icon="plus" variant="secondary" onPress={onAdd} />
      </View>
      <PressableScale role="link" onPress={() => router.push('/equipment' as never)} style={styles.link}>
        <Caption tone="accent">What each piece is for</Caption>
      </PressableScale>
    </View>
  );
}

const FOLD_PICTURE: Record<'lab' | 'preps', string> = { lab: 'Citric Acid', preps: 'Lime Cordial' };

/** Sections with nothing in them yet, one line each, so a beginner's My Bar stays short. */
export function MoreSections({ empty, onOpen, style }: { empty: ('lab' | 'preps' | 'kit')[]; onOpen: (section: 'lab' | 'preps' | 'kit') => void; style?: StyleProp<ViewStyle> }) {
  const ds = useDs();
  return (
    <View role="group" accessibilityLabel="More of your bar" style={[styles.folds, style]}>
      {empty.map((section) => (
        <PressableScale
          key={section}
          accessibilityLabel={`${SECTIONS[section].title}. ${SECTIONS[section].empty}`}
          accessibilityHint="Opens Add to your bar"
          onPress={() => onOpen(section)}
          style={[styles.fold, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}
        >
          {section === 'kit' ? (
            <View style={[styles.kitIcon, { backgroundColor: ds.c.paper }]}>
              <IconSymbol name="gearshape" size={18} color={ds.c.sketchInk} />
            </View>
          ) : (
            <IngredientThumb name={FOLD_PICTURE[section]} size={32} />
          )}
          <View style={styles.text}>
            <Headline>{SECTIONS[section].title}</Headline>
            <Caption tone="muted">{SECTIONS[section].empty}</Caption>
          </View>
          <IconSymbol name="plus" size={16} color={ds.c.muted} />
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  head: { gap: 2 },
  title: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  jump: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  jumpLink: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexBasis: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth, paddingLeft: space.sm },
  tileOpen: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 56 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, minHeight: layout.minTapTarget },
  text: { flex: 1, gap: 2 },
  remove: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  folds: { gap: space.sm },
  link: { alignSelf: 'flex-start', minHeight: layout.minTapTarget, justifyContent: 'center' },
  fold: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
  kitIcon: { width: 32, height: 32, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
});
