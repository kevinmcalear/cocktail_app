import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Caption, Chip, EquipmentDrawing, EquipmentThumb, GlassButton, Headline, IngredientDrawing, IngredientThumb, PressableScale, useBreakpoint, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import type { ShelfItem } from '@/hooks/useHomeBar';
import { madeLine, SECTIONS, type BarSection } from '@/lib/barSections';
import { itemHref } from '@/lib/itemRoutes';
import { EQUIPMENT, EQUIPMENT_KINDS, equipmentById } from '@/lib/techniques';

import { AddTile, BarTile, TileGrid } from './BarTile';

export type Jumpable = BarSection | 'kit';

/** A section's title and count, with its actions on the right (a sort, Edit), icons all. */
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

/**
 * Edit, while there's something to take off: a pencil, then a tinted check
 * for Done (the iOS 26 confirm button). Icons only, like the sort beside it;
 * adding is the Add tile in the grid. A long press on a tile edits too.
 */
export function SectionActions({ section, editing, onEdit, canEdit }: { section: Jumpable; editing: boolean; onEdit: (on: boolean) => void; canEdit: boolean }) {
  const ds = useDs();
  const title = SECTIONS[section].title;
  if (!canEdit) return null;
  return <GlassButton icon={editing ? 'checkmark' : 'pencil'} color={editing ? ds.accentText : undefined} accessibilityLabel={editing ? `Done editing ${title}` : `Edit ${title}`} onPress={() => onEdit(!editing)} />;
}

/**
 * The sections as filter chips with their counts: All, then each section.
 * The same row on My Bar and in Add to your bar. `multi` (My Bar): a tap shows
 * that section alone, more taps add sections, All shows everything. Otherwise
 * one is picked at a time. `bleed`: the page gutter, so the row scrolls edge to edge.
 */
export function SectionChips({ sections, counts, picked, onPick, multi, bleed = 0 }: { sections: readonly Jumpable[]; counts: Partial<Record<Jumpable, number>>; picked: readonly Jumpable[]; onPick: (section: Jumpable | 'all') => void; multi?: boolean; bleed?: number }) {
  const phone = useBreakpoint() === 'phone';
  const chips = (
    <View role={multi ? 'group' : 'radiogroup'} accessibilityLabel="Sections" style={[styles.chips, phone ? null : styles.wrap]}>
      <Chip label="All" selected={!picked.length} multi={multi} onPress={() => onPick('all')} />
      {sections.map((section) => (
        <Chip key={section} label={SECTIONS[section].short} count={counts[section]} selected={picked.includes(section)} multi={multi} onPress={() => onPick(section)} />
      ))}
    </View>
  );
  // A phone scrolls the row sideways; with a mouse that's hard to find, so wider screens wrap.
  if (!phone) return chips;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.chipsScroll, { marginHorizontal: -bleed }]} contentContainerStyle={[styles.chips, { paddingHorizontal: bleed }]}>
      {chips}
    </ScrollView>
  );
}

export const usedLine = (uses: number) => (uses ? `In ${uses} ${uses === 1 ? 'drink' : 'drinks'}` : 'Not used yet');

/**
 * A shelf item's tile: opens it, or while editing takes it off on a tap.
 * A long press starts editing (`onHold`). Memo-free on purpose: a section
 * re-renders as a whole when the shelf changes.
 */
export function ShelfTile({ item, meta, editing, onRemove, onHold }: { item: ShelfItem; meta?: string | null; editing: boolean; onRemove: (id: string) => void; onHold?: () => void }) {
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
      // Kept while editing: the release that ends the long press must not count as a tap on the remove action it just revealed.
      onLongPress={onHold}
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
        <SectionActions section="lab" editing={editing} onEdit={onEdit} canEdit={items.length > 0} />
      </SectionHead>
      <TileGrid cols={cols}>
        {editing ? null : <AddTile label={SECTIONS.lab.add} onPress={onAdd} />}
        {items.map((item) => (
          <ShelfTile key={item.id} item={item} editing={editing} onRemove={onRemove} onHold={() => onEdit(true)} />
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
        <SectionActions section="preps" editing={editing} onEdit={onEdit} canEdit={items.length > 0} />
      </SectionHead>
      <TileGrid cols={cols}>
        {editing ? null : <AddTile label={SECTIONS.preps.add} onPress={onAdd} />}
        {items.map((item) => (
          <ShelfTile key={item.id} item={item} meta={madeLine(item.addedAt) ?? usedLine(item.uses)} editing={editing} onRemove={onRemove} onHold={() => onEdit(true)} />
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
  // Enough faded suggestions to finish the row (after the Add tile), and never more than one row.
  const room = editing ? 0 : (cols - ((kit.length + 1) % cols)) % cols;
  const ideas = KIT_SUGGESTIONS.filter((id) => !owned.includes(id)).slice(0, room).flatMap((id) => equipmentById(id) ?? []);
  return (
    <View style={[styles.section, style]}>
      <SectionHead section="kit" count={kit.length}>
        <SectionActions section="kit" editing={editing} onEdit={onEdit} canEdit={kit.length > 0} />
      </SectionHead>
      <TileGrid cols={cols}>
        {editing ? null : <AddTile label={SECTIONS.kit.add} onPress={onAdd} />}
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
            onLongPress={() => onEdit(true)}
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
  chipsScroll: { flexGrow: 0 },
  chips: { flexDirection: 'row', gap: space.sm },
  wrap: { flexWrap: 'wrap' },
  text: { flex: 1, gap: 2 },
  folds: { gap: space.sm },
  link: { alignSelf: 'flex-start', minHeight: layout.minTapTarget, justifyContent: 'center' },
  fold: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
});
