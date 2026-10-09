import { memo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, GlassButton, useDs } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { space } from '@/constants/tokens';
import type { ShelfItem } from '@/hooks/useHomeBar';
import { SECTIONS } from '@/lib/barSections';
import type { ShelfSort } from '@/lib/pantry';

import { SectionActions, SectionHead, ShelfTile } from './BarSections';
import { AddTile, TileGrid } from './BarTile';

const SORTS: { value: ShelfSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'used', label: 'Most used' },
  { value: 'unused', label: 'Unused' },
  { value: 'az', label: 'A to Z' },
  { value: 'style', label: 'By style' },
];
/** A shelf this long gets a search box. */
const SEARCH_FROM = 9;

interface ShelfHeadProps {
  count: number;
  sort: ShelfSort;
  onSort: (sort: ShelfSort) => void;
  query: string;
  onQuery: (query: string) => void;
  editing: boolean;
  onEdit: (on: boolean) => void;
}

/**
 * The top of Bottles: its count, the sort (an icon that opens the choices,
 * so it never looks like the bottles; tinted when it isn't Newest), Edit, and a search box for a
 * long shelf. The bottles are rows of My Bar's list (BottleTiles), then ShelfFoot.
 */
export function ShelfHead({ count, sort, onSort, query, onQuery, editing, onEdit }: ShelfHeadProps) {
  const ds = useDs();
  const [sorting, setSorting] = useState(false);
  const current = SORTS.find((s) => s.value === sort)?.label ?? 'Newest';
  return (
    <View style={styles.section}>
      <SectionHead section="bottles" count={count}>
        {count > 1 && !editing ? (
          <GlassButton icon="line.3.horizontal.decrease" color={sort === 'newest' ? undefined : ds.accentText} accessibilityLabel={`Sort bottles, now ${current}`} onPress={() => setSorting(true)} />
        ) : null}
        <SectionActions section="bottles" editing={editing} onEdit={onEdit} canEdit={count > 0} />
      </SectionHead>
      {count >= SEARCH_FROM ? (
        <Field label="Search your bottles" value={query} onChangeText={onQuery} placeholder="Gin, Campari…" autoCorrect={false} autoCapitalize="none" returnKeyType="search" />
      ) : null}
      <MenuSheet visible={sorting} onClose={() => setSorting(false)} title="Sort bottles">
        <View role="radiogroup" accessibilityLabel="Sort your bottles" style={styles.sorts}>
          {SORTS.map((s) => (
            <Chip
              key={s.value}
              label={s.label}
              selected={sort === s.value}
              onPress={() => {
                onSort(s.value);
                setSorting(false);
              }}
            />
          ))}
        </View>
      </MenuSheet>
    </View>
  );
}

/** Under the bottles: why none show, or Show all / Show fewer (`foldable`: more than the folded shelf holds). */
export function ShelfFoot({ found, foldable, sort, query, open, onOpen }: { found: number; foldable: boolean; sort: ShelfSort; query: string; open: boolean; onOpen: (open: boolean) => void }) {
  const q = query.trim();
  const note = q && !found ? `No bottle on your shelf matches “${q}”.` : sort === 'unused' && !found ? 'Every bottle goes into something you can make.' : null;
  if (!note && !foldable) return null;
  return (
    <View style={styles.foot}>
      {note ? <Body tone="muted">{note}</Body> : null}
      {foldable ? <Button label={open ? 'Show fewer' : `Show all ${found}`} variant="ghost" onPress={() => onOpen(!open)} style={styles.left} /> : null}
    </View>
  );
}

interface BottleTilesProps {
  bottles: ShelfItem[];
  heading: string | null;
  /** The first row: it opens with the Add tile. */
  add?: boolean;
  cols: number;
  editing: boolean;
  onRemove: (id: string) => void;
  onAdd: () => void;
  /** A long press on a bottle: start editing Bottles. Stable (a state setter), so the memo holds. */
  onHold: (section: 'bottles') => void;
}

/**
 * One row of bottle tiles: drawing, name, and how many drinks each goes
 * into. Memoized: a list row, re-rendered
 * by every change to the list.
 */
export const BottleTiles = memo(function BottleTiles({ bottles, heading, add, cols, editing, onRemove, onAdd, onHold }: BottleTilesProps) {
  return (
    <View style={styles.row}>
      {heading ? <Caption tone="muted">{heading}</Caption> : null}
      <TileGrid cols={cols}>
        {add ? <AddTile label={SECTIONS.bottles.add} onPress={onAdd} /> : null}
        {bottles.map((b) => (
          <ShelfTile key={b.id} item={b} editing={editing} onRemove={onRemove} onHold={() => onHold('bottles')} />
        ))}
      </TileGrid>
    </View>
  );
});

const styles = StyleSheet.create({
  section: { gap: space.md, paddingBottom: space.md },
  sorts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingBottom: space.lg },
  foot: { gap: space.md, paddingTop: space.md },
  left: { alignSelf: 'flex-start' },
  row: { gap: space.sm, paddingTop: space.lg },
});
