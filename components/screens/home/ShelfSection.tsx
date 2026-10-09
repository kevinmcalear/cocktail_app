import { memo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { layout, space } from '@/constants/tokens';
import type { ShelfItem } from '@/hooks/useHomeBar';
import { SHELF_FOLDED_ROWS } from '@/lib/myBarRows';
import type { ShelfSort } from '@/lib/pantry';

import { SectionActions, SectionHead, ShelfTile } from './BarSections';
import { TileGrid } from './BarTile';

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
  onAdd: () => void;
}

/**
 * The top of Bottles: its count, the sort (an icon that opens the choices,
 * so it never looks like the bottles; tinted when it isn't Newest), Edit and Add, and a search box for a
 * long shelf. The bottles are rows of My Bar's list (BottleTiles), then ShelfFoot.
 */
export function ShelfHead({ count, sort, onSort, query, onQuery, editing, onEdit, onAdd }: ShelfHeadProps) {
  const ds = useDs();
  const [sorting, setSorting] = useState(false);
  const current = SORTS.find((s) => s.value === sort)?.label ?? 'Newest';
  return (
    <View style={styles.section}>
      <SectionHead section="bottles" count={count}>
        {count > 1 && !editing ? (
          <PressableScale role="button" accessibilityLabel={`Sort bottles, now ${current}`} onPress={() => setSorting(true)} style={styles.sort}>
            <IconSymbol name="line.3.horizontal.decrease" size={20} color={sort === 'newest' ? ds.c.ink : ds.accentText} />
          </PressableScale>
        ) : null}
        <SectionActions section="bottles" editing={editing} onEdit={onEdit} onAdd={onAdd} canEdit={count > 0} />
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

/** Under the bottles: why none show, or Show all / Show fewer. */
export function ShelfFoot({ found, cols, sort, query, open, onOpen }: { found: number; cols: number; sort: ShelfSort; query: string; open: boolean; onOpen: (open: boolean) => void }) {
  const q = query.trim();
  const folded = SHELF_FOLDED_ROWS * cols;
  const note = q && !found ? `No bottle on your shelf matches “${q}”.` : sort === 'unused' && !found ? 'Every bottle goes into something you can make.' : null;
  if (!note && (q || found <= folded)) return null;
  return (
    <View style={styles.foot}>
      {note ? <Body tone="muted">{note}</Body> : null}
      {!q && found > folded ? <Button label={open ? 'Show fewer' : `Show all ${found}`} variant="ghost" onPress={() => onOpen(!open)} style={styles.left} /> : null}
    </View>
  );
}

/**
 * One row of bottle tiles: drawing, name, and how many drinks each goes
 * into. Memoized: a list row, re-rendered
 * by every change to the list.
 */
export const BottleTiles = memo(function BottleTiles({ bottles, heading, cols, editing, onRemove }: { bottles: ShelfItem[]; heading: string | null; cols: number; editing: boolean; onRemove: (id: string) => void }) {
  return (
    <View style={styles.row}>
      {heading ? <Caption tone="muted">{heading}</Caption> : null}
      <TileGrid cols={cols}>
        {bottles.map((b) => (
          <ShelfTile key={b.id} item={b} editing={editing} onRemove={onRemove} />
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
  sort: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  row: { gap: space.sm, paddingTop: space.lg },
});
