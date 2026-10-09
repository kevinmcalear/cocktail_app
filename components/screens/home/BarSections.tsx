import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button, Caption, EquipmentDrawing, EquipmentThumb, GlassButton, Headline, IngredientDrawing, IngredientThumb, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import type { ShelfItem } from '@/hooks/useHomeBar';
import { madeLine, SECTIONS, type BarSection } from '@/lib/barSections';
import { itemHref } from '@/lib/itemRoutes';
import { EQUIPMENT, EQUIPMENT_KINDS, equipmentById } from '@/lib/techniques';

import { BarTile, TileGrid } from './BarTile';

export type Jumpable = BarSection | 'kit';

/** A section's title and count, with its actions on the right (Edit, Add, a sort). */
export function SectionHead({ section, count, children }: { section: Jumpable; count?: number; children?: ReactNode }) {
  return (
    <View style={styles.head}>
      <View style={styles.title}>
        <Headline role="heading" numberOfLines={1}>
          {SECTIONS[section].title}
        </Headline>
        {count ? <Caption tone="muted">{count}</Caption> : null}
      </View>
      {children}
    </View>
  );
}

/** Edit (tap a tile to take it off) while there's something to take off, and Add. */
export function SectionActions({ section, editing, onEdit, onAdd, canEdit }: { section: Jumpable; editing: boolean; onEdit: (on: boolean) => void; onAdd: () => void; canEdit: boolean }) {
  const title = SECTIONS[section].title;
  return (
    <>
      {canEdit ? <Button label={editing ? 'Done' : 'Edit'} variant="ghost" accessibilityLabel={editing ? `Done editing ${title}` : `Edit ${title}`} onPress={() => onEdit(!editing)} /> : null}
      {editing ? null : <GlassButton icon="plus" accessibilityLabel={`Add to ${title}`} onPress={onAdd} />}
    </>
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

export const usedLine = (uses: number) => (uses ? `In ${uses} ${uses === 1 ? 'drink' : 'drinks'}` : 'Not used yet');

/**
 * A shelf item's tile: opens it, or while editing takes it off on a tap.
 * Memo-free on purpose: a section re-renders as a whole when the shelf changes.
 */
export function ShelfTile({ item, meta, editing, onRemove }: { item: ShelfItem; meta?: string | null; editing: boolean; onRemove: (id: string) => void }) {
  const router = useRouter();
  const line = meta === undefined ? usedLine(item.uses) : meta;
  return (
    <BarTile
      name={item.name}
      meta={line}
      metaTone={meta === undefined && item.uses ? 'accent' : 'muted'}
      picture={<IngredientDrawing id={item.id} name={item.name} />}
      role={editing ? 'button' : 'link'}
      accessibilityLabel={editing ? `Take ${item.name} off your bar` : [item.name, line].filter(Boolean).join(', ')}
      badge={editing ? 'remove' : null}
      onPress={() => (editing ? onRemove(item.id) : router.push(itemHref('Ingredient', item.id) as never))}
    />
  );
}

interface TileSectionProps {
  items: ShelfItem[];
  cols: number;
  editing: boolean;
  onEdit: (on: boolean) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}

/** Acids, enzymes and gums. */
export function LabSection({ items, cols, editing, onEdit, onAdd, onRemove, style }: TileSectionProps) {
  return (
    <View style={[styles.section, style]}>
      <SectionHead section="lab" count={items.length}>
        <SectionActions section="lab" editing={editing} onEdit={onEdit} onAdd={onAdd} canEdit={items.length > 0} />
      </SectionHead>
      <TileGrid cols={cols}>
        {items.map((item) => (
          <ShelfTile key={item.id} item={item} editing={editing} onRemove={onRemove} />
        ))}
      </TileGrid>
    </View>
  );
}

/** House preps you have, and when you made each. */
export function PrepsSection({ items, cols, editing, onEdit, onAdd, onRemove, style }: TileSectionProps) {
  return (
    <View style={[styles.section, style]}>
      <SectionHead section="preps" count={items.length}>
        <SectionActions section="preps" editing={editing} onEdit={onEdit} onAdd={onAdd} canEdit={items.length > 0} />
      </SectionHead>
      <TileGrid cols={cols}>
        {items.map((item) => (
          <ShelfTile key={item.id} item={item} meta={madeLine(item.addedAt) ?? usedLine(item.uses)} editing={editing} onRemove={onRemove} />
        ))}
      </TileGrid>
    </View>
  );
}

/** Kit suggested to someone who has little: the bar tools, cheapest first, as faded tiles to tap. */
const KIT_SUGGESTIONS = EQUIPMENT.filter((e) => e.kind === 'bar' && e.tier === '$').map((e) => e.id);
const kindName = (kind: string) => EQUIPMENT_KINDS.find((k) => k.id === kind)?.name ?? null;

/** The kit you have, a few common pieces to tap in, and where each piece is explained. */
export function KitSection({ owned, cols, editing, onEdit, onToggle, onAdd, style }: { owned: readonly string[]; cols: number; editing: boolean; onEdit: (on: boolean) => void; onToggle: (id: string) => void; onAdd: () => void; style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  const kit = owned.flatMap((id) => equipmentById(id) ?? []);
  // Enough faded suggestions to finish the row, and never more than one row.
  const room = editing ? 0 : (cols - (kit.length % cols)) % cols || (kit.length ? 0 : cols);
  const ideas = KIT_SUGGESTIONS.filter((id) => !owned.includes(id)).slice(0, room).flatMap((id) => equipmentById(id) ?? []);
  return (
    <View style={[styles.section, style]}>
      <SectionHead section="kit" count={kit.length}>
        <SectionActions section="kit" editing={editing} onEdit={onEdit} onAdd={onAdd} canEdit={kit.length > 0} />
      </SectionHead>
      <TileGrid cols={cols}>
        {kit.map((e) => (
          <BarTile
            key={e.id}
            name={e.name}
            meta={kindName(e.kind)}
            picture={<EquipmentDrawing id={e.id} />}
            role={editing ? 'button' : 'link'}
            accessibilityLabel={editing ? `Take ${e.name} out of your kit` : e.name}
            badge={editing ? 'remove' : null}
            onPress={() => (editing ? onToggle(e.id) : router.push(`/equipment/${e.id}` as never))}
          />
        ))}
        {ideas.map((e) => (
          <BarTile key={e.id} name={e.name} meta="Tap if you have it" picture={<EquipmentDrawing id={e.id} />} role="button" accessibilityLabel={`I have ${e.name}`} ghost badge="plus" onPress={() => onToggle(e.id)} />
        ))}
      </TileGrid>
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
            <EquipmentThumb id="shaker" name="Shaker tins" size={32} />
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
  head: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  title: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: space.sm, minWidth: 0 },
  jump: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  jumpLink: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill },
  text: { flex: 1, gap: 2 },
  folds: { gap: space.sm },
  link: { alignSelf: 'flex-start', minHeight: layout.minTapTarget, justifyContent: 'center' },
  fold: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
});
