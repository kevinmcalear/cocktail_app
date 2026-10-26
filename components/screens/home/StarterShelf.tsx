import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, FieldButton, Headline, IngredientDrawing, PressableScale, Surface, useDs, useGutter } from '@/components/ds';
import { ScreenHeaderSpacer } from '@/components/nav/ScreenHeader';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { useBarIdeas } from '@/hooks/useHomeBar';
import { IDEAS } from '@/lib/myBarAdd';
import { PANTRY, PANTRY_WATER } from '@/lib/pantry';

import { AddTile, BarTile, TileGrid, useTileCols } from './BarTile';
import type { AwayGroup } from './MakeRows';

/** The kitchen staples the starter offers: most drinks need one. Nothing starts ticked. */
const KITCHEN = ['Lemons', 'Limes', 'Oranges', 'Sugar', 'Eggs', 'Soda water'];

interface StarterShelfProps {
  /** The staples the catalog has, by name (usePantryItems). */
  pantry: { name: string; id: string }[];
  onShelf: Set<string>;
  /** Drinks one bottle away, so each common bottle says how many it opens. */
  oneAway: AwayGroup[];
  ready: number;
  bottles: number;
  bottom: number;
  onToggle: (id: string, on: boolean) => void;
  onAdd: (ids: string[]) => void;
  onSearch: () => void;
  onSnap: () => void;
  /** Leaves the starter for the whole of My Bar, at What to make. */
  onShowMe: () => void;
}

/**
 * My Bar before there's a bottle on it (board home-mybar-empty): tap the
 * bottles you have from the usual suspects, each saying how many drinks it
 * opens, tick what your kitchen keeps, and a bar pinned at the bottom counts
 * the drinks as you go. Nothing is saved until you tick it. Show me opens the
 * whole of My Bar.
 */
export function StarterShelf({ pantry, onShelf, oneAway, ready, bottles, bottom, onToggle, onAdd, onSearch, onSnap, onShowMe }: StarterShelfProps) {
  const ds = useDs();
  const gutter = useGutter();
  const cols = useTileCols();
  const ideas = useBarIdeas(IDEAS.bottles).data ?? [];
  const opens = new Map(oneAway.filter((g) => g.bottles.length === 1).map((g) => [g.bottles[0].id, g.drinks.length]));
  // The order is set once, when the bottles load, so a tile stays where it was tapped.
  const [order, setOrder] = useState<{ ids: string[]; ranked: boolean } | null>(null);
  if (!order && ideas.length) {
    const sorted = [...ideas].sort((a, b) => Number(onShelf.has(b.id)) - Number(onShelf.has(a.id)) || (opens.get(b.id) ?? 0) - (opens.get(a.id) ?? 0));
    setOrder({ ids: sorted.map((p) => p.id), ranked: sorted.some((p) => opens.has(p.id)) });
  }
  const rank = new Map(order?.ids.map((id, i) => [id, i]));
  const picks = order ? [...ideas].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity)) : [];
  const ids = new Map(pantry.map((p) => [p.name, p.id]));
  const kitchen = PANTRY.filter((p) => KITCHEN.includes(p.label)).flatMap((p) => (ids.has(p.name) ? [{ label: p.label, id: ids.get(p.name)! }] : []));
  const water = ids.get(PANTRY_WATER);
  const fromKitchen = kitchen.some((k) => onShelf.has(k.id));
  // Water comes with a staple, never shown: every house syrup is sugar or honey and water.
  const tickKitchen = (id: string) => (onShelf.has(id) ? onToggle(id, false) : onAdd(water && !onShelf.has(water) ? [id, water] : [id]));
  const from = [bottles ? `${bottles} ${bottles === 1 ? 'bottle' : 'bottles'}` : null, fromKitchen ? 'your kitchen' : null].filter(Boolean).join(' and ');

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: bottom + 96, maxWidth: 760, width: '100%' }} keyboardShouldPersistTaps="handled">
        <ScreenHeaderSpacer title="My Bar" />
        <View style={styles.section}>
          <Body tone="muted">Tap what’s on your shelf. We’ll show only drinks you can actually make.</Body>
          <View style={[styles.find, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
            <PressableScale role="button" accessibilityLabel="Find a bottle" onPress={onSearch} style={styles.findMain}>
              <IconSymbol name="magnifyingglass" size={18} color={ds.c.muted} />
              <Body tone="muted">Find a bottle</Body>
            </PressableScale>
            <FieldButton icon="camera.fill" label="Snap a bottle" onPress={onSnap} />
          </View>
        </View>
        <View style={styles.section}>
          <View>
            <Headline role="heading">The usual suspects</Headline>
            {order?.ranked ? <Caption tone="muted">Sorted by how many drinks each one opens</Caption> : null}
          </View>
          <TileGrid cols={cols}>
            {[
              ...picks.map((p) => {
                const has = onShelf.has(p.id);
                const n = opens.get(p.id) ?? 0;
                return (
                  <BarTile
                    key={p.id}
                    name={p.name}
                    meta={!has && n ? `+${n} ${n === 1 ? 'drink' : 'drinks'}` : null}
                    picture={<IngredientDrawing id={p.id} name={p.name} lazy />}
                    role="checkbox"
                    checked={has}
                    accessibilityLabel={p.name}
                    accessibilityHint={has ? 'Takes it off your shelf' : 'Puts it on your shelf'}
                    badge={has ? 'check' : 'plus'}
                    onPress={() => onToggle(p.id, !has)}
                  />
                );
              }),
              <AddTile key="else" label="Something else" sub="Search every bottle" onPress={onSearch} />,
            ]}
          </TileGrid>
        </View>
        <View style={styles.section}>
          <View>
            <Headline role="heading">In your kitchen</Headline>
            <Caption tone="muted">Most drinks need one of these. Tick what you keep.</Caption>
          </View>
          <View role="group" accessibilityLabel="In your kitchen" style={styles.chips}>
            {kitchen.map((k) => (
              <Chip key={k.id} label={k.label} multi selected={onShelf.has(k.id)} onPress={() => tickKitchen(k.id)} />
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={[styles.pinned, { bottom, paddingHorizontal: gutter }]} pointerEvents="box-none">
        <Surface style={styles.bar}>
          <Body style={styles.flex} aria-live="polite">
            {`${ready} ${ready === 1 ? 'drink' : 'drinks'}${from ? ` from ${from}` : ''}`}
          </Body>
          <Button label="Show me" variant="primary" onPress={onShowMe} />
        </Surface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  section: { gap: space.md, paddingTop: space.xl },
  find: { flexDirection: 'row', alignItems: 'center', minHeight: layout.minTapTarget, borderRadius: radius.control, borderWidth: 1 },
  findMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget, paddingLeft: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pinned: { position: 'absolute', left: 0, right: 0, maxWidth: 760 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
});
