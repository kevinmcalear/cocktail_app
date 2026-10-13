import { useRouter } from 'expo-router';
import { useDeferredValue, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Field, FieldButton, IngredientThumb } from '@/components/ds';
import { Eyebrow } from '@/components/screens/addDrink/WizardChrome';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { space } from '@/constants/tokens';
import { useBarIdeas, useBarSearch, type FoundItem } from '@/hooks/useHomeBar';
import { SECTIONS, type BarSection } from '@/lib/barSections';
import { itemHref } from '@/lib/itemRoutes';
import { focusInModal, MODAL_AUTOFOCUS } from '@/lib/modalAutoFocus';
import { SHELF_SECTIONS } from '@/lib/myBarRows';
import { foundLine } from '@/lib/myBarText';
import { TECHNICAL_INGREDIENTS } from '@/lib/techniques';

import { IdeaTile, KitResults, RecipeLink, Result, SnapRow } from './AddToBarParts';
import { SectionChips } from './BarSections';
import { TileGrid, useTileCols } from './BarTile';

export type AddFilter = 'all' | BarSection | 'kit';

/** The line under the section filter, for each section. */
const BLURBS: Record<AddFilter, string> = {
  all: 'Tap what you keep. It goes in the right section of My Bar.',
  bottles: SECTIONS.bottles.blurb,
  fridge: 'Fruit, sugar, eggs and mixers. Most drinks need a few of these.',
  lab: SECTIONS.lab.blurb,
  preps: 'Syrups and cordials you make. Tap the ones in your fridge now, or open a recipe to make one.',
  kit: SECTIONS.kit.blurb,
};
const ORDER: BarSection[] = ['bottles', 'fridge', 'lab', 'preps'];

/** What each tab offers before anything is typed, by catalog name. */
export const IDEAS: Record<Exclude<AddFilter, 'kit'>, readonly string[]> = {
  all: ['Gin', 'Lemon', 'Simple Syrup', 'Campari', 'Lime', 'Sweet Vermouth', 'Angostura Bitters', 'Sugar', 'Rye Whiskey', 'Egg', 'Soda Water', 'Mezcal'],
  bottles: ['Gin', 'Campari', 'Sweet Vermouth', 'Angostura Bitters', 'Rye Whiskey', 'Bourbon', 'White Rum', 'Tequila', 'Mezcal', 'Vodka', 'Dry Vermouth', 'Aperol'],
  fridge: ['Lemon', 'Lime', 'Orange', 'Grapefruit', 'Sugar', 'Honey', 'Egg', 'Soda Water', 'Mint', 'Tonic Water', 'Heavy Cream', 'Pineapple'],
  lab: TECHNICAL_INGREDIENTS.map((t) => t.name.replace(/ \(.*\)$/, '')),
  preps: ['Simple Syrup', 'Rich Simple Syrup', 'Saline', 'Lime Cordial', 'Oleo Saccharum', 'Orgeat', 'Grenadine', 'Honey Syrup'],
};

interface AddToBarSheetProps {
  visible: boolean;
  /** The tab it opens on, when a section's Add opened it. */
  filter: AddFilter;
  onFilter: (filter: AddFilter) => void;
  onShelf: Set<string>;
  /** How much of each section is on the bar, for the tabs. */
  counts: Partial<Record<AddFilter, number>>;
  onToggle: (item: FoundItem, add: boolean) => void;
  onClose: () => void;
  /** Snap a bottle instead: the camera in the search field and under the results. */
  onSnap: () => void;
}

/**
 * One search for everything on your bar: bottles, fridge, lab, house preps
 * and kit. The sections are the same filter chips as My Bar's, one picked at
 * a time here; what's in them is picture tiles you tick, the same tiles as
 * My Bar. Typed results are listed under the section each goes in.
 */
export function AddToBarSheet({ visible, filter, onFilter, onShelf, counts, onToggle, onClose, onSnap }: AddToBarSheetProps) {
  const router = useRouter();
  const cols = useTileCols();
  const [query, setQuery] = useState('');
  const searchRef = useRef<ComponentRef<typeof TextInput>>(null);
  const typed = query.trim();
  const found = useBarSearch(filter === 'kit' ? '' : query);
  const ideas = useBarIdeas(filter === 'kit' ? [] : IDEAS[filter]);
  // Results for older text stay up while the new search runs, so only an empty list waits.
  const rows = typed ? (found.data ?? []).filter((r) => filter === 'all' || r.section === filter) : [];
  const groups = ORDER.flatMap((section) => {
    const items = rows.filter((r) => r.section === section);
    return items.length ? [{ section, items }] : [];
  });
  // The sheet answers the tap at once; its tiles render just after, in the
  // background (RAIL: a tap shows something within 100 ms).
  const filled = useDeferredValue(visible);
  // While typing, each chip counts its matches; otherwise what's on the bar.
  const all = typed && filter !== 'kit' ? (found.data ?? []) : null;
  const chipCounts = all ? Object.fromEntries(ORDER.map((sec) => [sec, all.filter((r) => r.section === sec).length])) : counts;
  const total = all ? all.length : SHELF_SECTIONS.reduce((n, sec) => n + (counts[sec] ?? 0), 0);
  const snap = () => {
    onClose();
    onSnap();
  };
  const openRecipe = (id: string) => {
    onClose();
    router.push(itemHref('Ingredient', id) as never);
  };

  return (
    <MenuSheet
      visible={visible}
      onClose={onClose}
      title="Add to your bar"
      subtitle={total && !all ? `${total} on your bar` : undefined}
      onShow={MODAL_AUTOFOCUS ? undefined : () => focusInModal(searchRef)}
    >
      <Field
        ref={searchRef}
        label="Search everything"
        value={query}
        onChangeText={setQuery}
        placeholder="Gin, lemons, malic acid, a shaker…"
        icon="magnifyingglass"
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus={MODAL_AUTOFOCUS}
        returnKeyType="search"
        trailing={
          <>
            {query ? <FieldButton icon="xmark.circle.fill" label="Clear search" onPress={() => setQuery('')} /> : null}
            <FieldButton icon="camera.fill" label="Snap a bottle" onPress={snap} />
          </>
        }
      />
      <SectionChips sections={SHELF_SECTIONS} counts={chipCounts} total={total || undefined} picked={filter === 'all' ? [] : [filter]} onPick={onFilter} bleed={space.xl} />
      <View style={styles.results}>
        {typed ? null : <Body tone="muted">{BLURBS[filter]}</Body>}
        {!filled ? null : filter === 'kit' ? (
          <KitResults query={typed} cols={cols} />
        ) : !typed ? (
          <View style={styles.group}>
            <Eyebrow>{filter === 'all' ? 'Most used in drinks' : `Common ${SECTIONS[filter].short.toLowerCase()}`}</Eyebrow>
            <TileGrid cols={cols}>
              {(ideas.data ?? []).map((item) => {
                const has = onShelf.has(item.id);
                const tile = <IdeaTile key={item.id} item={item} has={has} onToggle={onToggle} />;
                return item.section === 'preps' ? (
                  <View key={item.id} style={styles.withLink}>
                    {tile}
                    <RecipeLink name={item.name} onPress={() => openRecipe(item.id)} />
                  </View>
                ) : (
                  tile
                );
              })}
            </TileGrid>
          </View>
        ) : found.error && !rows.length ? (
          <Body tone="muted">Couldn’t search right now. Check your connection and try again.</Body>
        ) : !rows.length ? (
          found.isFetching || found.isPending ? (
            <Body tone="muted">Looking…</Body>
          ) : (
            <>
              <Body tone="muted">{`Nothing called “${typed}” yet.${filter === 'all' ? '' : ' Try All.'}`}</Body>
              <SnapRow onSnap={snap} />
            </>
          )
        ) : (
          [...groups.map((g) => (
            <View key={g.section}>
              {filter === 'all' ? (
                <View style={styles.heading}>
                  <Eyebrow>{SECTIONS[g.section].title}</Eyebrow>
                </View>
              ) : null}
              {g.items.map((item) => (
                <Result
                  key={item.id}
                  name={item.name}
                  sub={item.section === 'preps' && onShelf.has(item.id) ? 'In your fridge' : foundLine(item)}
                  query={typed}
                  thumb={<IngredientThumb id={item.id} name={item.name} size={48} />}
                  has={onShelf.has(item.id)}
                  onToggle={(on) => onToggle(item, on)}
                  extra={item.section === 'preps' ? <RecipeLink name={item.name} onPress={() => openRecipe(item.id)} /> : null}
                />
              ))}
            </View>
          )), <SnapRow key="snap" onSnap={snap} />]
        )}
      </View>
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  // Holds the sheet's height steady while results come and go.
  results: { minHeight: 320, gap: space.md },
  group: { gap: space.sm },
  heading: { paddingTop: space.md },
  withLink: { gap: 0 },
});
