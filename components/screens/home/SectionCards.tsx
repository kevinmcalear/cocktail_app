import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, EquipmentThumb, IngredientThumb, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import type { ShelfItem } from '@/hooks/useHomeBar';
import { SECTIONS } from '@/lib/barSections';
import { cardFit, type ShelfSection } from '@/lib/myBarRows';
import { PANTRY, PANTRY_WATER } from '@/lib/pantry';
import { equipmentById } from '@/lib/techniques';

import { KIT_SUGGESTIONS } from './BarSections';

const TILE = 56;
const GAP = space.sm + 2;
/** Rows of tiles a card shows (the Add tile first) before "+N more". */
const CARD_ROWS = 2;

interface CardTile {
  key: string;
  name: string;
  picture: ReactNode;
  onPress: () => void;
}

export interface SectionCardData {
  section: ShelfSection;
  count: number;
  tiles: CardTile[];
  /** Faded suggestions to tap in (the staples you don't have, common kit), finishing the last row. */
  ideas: CardTile[];
}

/**
 * The shelf's sections as cards for a tablet's My Bar (mybar-tablet-proposal,
 * option C): each a count and its first few things as small tiles. Its title
 * opens the section; an empty one opens Add to your bar on it.
 */
export function SectionCards({ cards, onOpen, onAdd }: { cards: SectionCardData[]; onOpen: (section: ShelfSection) => void; onAdd: (section: ShelfSection) => void }) {
  const rows: SectionCardData[][] = [];
  for (let i = 0; i < cards.length; i += 2) rows.push(cards.slice(i, i + 2));
  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row[0].section} style={styles.row}>
          {row.map((card) => (
            <SectionCard key={card.section} card={card} onOpen={() => (card.count ? onOpen(card.section) : onAdd(card.section))} onAdd={() => onAdd(card.section)} />
          ))}
        </View>
      ))}
    </View>
  );
}

function SectionCard({ card, onOpen, onAdd }: { card: SectionCardData; onOpen: () => void; onAdd: () => void }) {
  const ds = useDs();
  const [width, setWidth] = useState(0);
  const { title, add } = SECTIONS[card.section];
  // As many tiles as fit across the card, two rows of them; the Add tile takes the first place.
  const fit = cardFit(width - 2 * space.md, card.tiles.length, { tile: TILE, gap: GAP, rows: CARD_ROWS, ideas: card.ideas.length });
  const shown = width ? card.tiles.slice(0, fit.shown) : [];
  const ideas = width ? card.ideas.slice(0, fit.ideas) : [];
  const more = width ? fit.more : 0;
  return (
    <View role="group" accessibilityLabel={title} style={[styles.card, { backgroundColor: ds.c.surface }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <PressableScale role="link" accessibilityLabel={card.count ? `${title}, ${card.count}` : `${title}: ${add}`} onPress={onOpen} style={styles.head}>
        <DsText numberOfLines={1} style={styles.title}>
          {title}
        </DsText>
        {card.count ? <Caption tone="muted">{card.count}</Caption> : null}
        <View style={styles.flex} />
        {more > 0 ? <Caption tone="muted">{`+${more} more`}</Caption> : null}
        <IconSymbol name="chevron.right" size={14} color={ds.c.muted} />
      </PressableScale>
      <View style={styles.tiles}>
        <PressableScale role="button" accessibilityLabel={add} onPress={onAdd} style={styles.tile}>
          <View style={[styles.square, styles.dashed, { borderColor: ds.c.lineStrong }]}>
            <IconSymbol name="plus" size={20} color={ds.c.muted} />
          </View>
          <Caption tone="muted" style={styles.name}>
            Add
          </Caption>
        </PressableScale>
        {shown.map((t) => (
          <PressableScale key={t.key} role="link" accessibilityLabel={t.name} onPress={t.onPress} style={styles.tile}>
            <View style={styles.square}>{t.picture}</View>
            <Caption numberOfLines={2} style={styles.name}>
              {t.name}
            </Caption>
          </PressableScale>
        ))}
        {ideas.map((t) => (
          <PressableScale key={t.key} role="button" accessibilityLabel={`I have ${t.name}`} onPress={t.onPress} style={styles.tile}>
            <View style={[styles.square, styles.dashed, { borderColor: ds.c.lineStrong }]}>
              <View style={styles.faded}>{t.picture}</View>
            </View>
            <Caption tone="muted" numberOfLines={2} style={styles.name}>
              {t.name}
            </Caption>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

/**
 * Each section's card: what's in it, newest first as My Bar lists it. A
 * shelf tile opens the bottle sheet, kit its page.
 */
export function useSectionCards({ on, bottles, pantry, fridge, lab, preps, owned, shelf, onShelf, counts, onItem, onSection, onAddIds, onToggleKit }: {
  /** Only a tablet's overview shows the cards; elsewhere none are built. */
  on: boolean;
  bottles: ShelfItem[];
  pantry: { id: string; name: string }[];
  fridge: ShelfItem[];
  lab: ShelfItem[];
  preps: ShelfItem[];
  owned: readonly string[];
  shelf: ShelfItem[];
  onShelf: Set<string>;
  counts: Record<ShelfSection, number>;
  /** A shelf tile's tap: My Bar's bottle sheet. */
  onItem: (item: ShelfItem) => void;
  /** A staple whose shelf row hasn't loaded opens its section instead. */
  onSection: (section: ShelfSection) => void;
  /** A faded staple's tap: it goes on the shelf (with water, as the fridge section adds it). */
  onAddIds: (ids: string[]) => void;
  /** A faded piece of kit's tap. */
  onToggleKit: (id: string) => void;
}): SectionCardData[] {
  const router = useRouter();
  if (!on) return [];
  const shelfTile = (item: ShelfItem, name = item.name): CardTile => ({ key: item.id, name, picture: <IngredientThumb id={item.id} name={item.name} size={TILE} />, onPress: () => onItem(item) });
  // The staples you keep, as the fridge section lists them, then anything else you've added.
  const ids = new Map(pantry.map((p) => [p.name, p.id]));
  const byId = new Map(shelf.map((s) => [s.id, s]));
  const staples = PANTRY.flatMap((p) => {
    const id = ids.get(p.name);
    if (!id || !onShelf.has(id)) return [];
    const item = byId.get(id);
    return [item ? shelfTile(item, p.label) : { key: id, name: p.label, picture: <IngredientThumb id={id} name={p.name} size={TILE} />, onPress: () => onSection('fridge') }];
  });
  const water = ids.get(PANTRY_WATER);
  const missing = PANTRY.flatMap((p) => {
    const id = ids.get(p.name);
    return id && !onShelf.has(id) ? [{ key: id, name: p.label, picture: <IngredientThumb id={id} name={p.name} size={TILE} />, onPress: () => onAddIds(water && !onShelf.has(water) ? [id, water] : [id]) }] : [];
  });
  const kitIdeas = KIT_SUGGESTIONS.filter((id) => !owned.includes(id)).flatMap((id) => {
    const e = equipmentById(id);
    return e ? [{ key: e.id, name: e.name, picture: <EquipmentThumb id={e.id} name={e.name} size={TILE} />, onPress: () => onToggleKit(e.id) }] : [];
  });
  const kit = owned.flatMap((id) => {
    const e = equipmentById(id);
    return e ? [{ key: e.id, name: e.name, picture: <EquipmentThumb id={e.id} name={e.name} size={TILE} />, onPress: () => router.push(`/equipment/${e.id}` as never) }] : [];
  });
  const tiles: Record<ShelfSection, CardTile[]> = {
    bottles: bottles.map((b) => shelfTile(b)),
    fridge: [...staples, ...fridge.map((f) => shelfTile(f))],
    lab: lab.map((l) => shelfTile(l)),
    preps: preps.map((p) => shelfTile(p)),
    kit,
  };
  const ideas: Partial<Record<ShelfSection, CardTile[]>> = { fridge: missing, kit: kitIdeas };
  return (Object.keys(tiles) as ShelfSection[]).map((section) => ({ section, count: counts[section], tiles: tiles[section], ideas: ideas[section] ?? [] }));
}

const styles = StyleSheet.create({
  grid: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  card: { flex: 1, minWidth: 0, gap: space.md, padding: space.md, borderRadius: radius.card, borderCurve: 'continuous' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, minHeight: 32 },
  title: { fontFamily: fontFamilies.bodySemiBold, flexShrink: 1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', columnGap: GAP, rowGap: space.md },
  tile: { width: TILE, gap: space.xs + 2 },
  square: { width: TILE, height: TILE, borderRadius: radius.control - 2, borderCurve: 'continuous', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  dashed: { borderStyle: 'dashed', borderWidth: 1.5 },
  faded: { opacity: 0.4 },
  name: { fontFamily: fontFamilies.bodyMedium },
});
