import { useRouter } from 'expo-router';
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Caption, EquipmentDrawing, Field, Headline, IngredientDrawing, IngredientThumb, PressableScale, useDs } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';
import { useBarIdeas, useBarSearch, type FoundItem } from '@/hooks/useHomeBar';
import { useKit } from '@/hooks/useKit';
import { SECTIONS, type BarSection } from '@/lib/barSections';
import { itemHref } from '@/lib/itemRoutes';
import { focusInModal, MODAL_AUTOFOCUS } from '@/lib/modalAutoFocus';
import { SHELF_SECTIONS } from '@/lib/myBarRows';
import { EQUIPMENT, EQUIPMENT_KINDS, TECHNICAL_INGREDIENTS } from '@/lib/techniques';

import { SectionChips } from './BarSections';
import { BarTile, TileGrid, useTileCols } from './BarTile';

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
const IDEAS: Record<Exclude<AddFilter, 'kit'>, readonly string[]> = {
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
}

/**
 * One search for everything on your bar: bottles, fridge, lab, house preps
 * and kit. The sections are the same filter chips as My Bar's, one picked at
 * a time here; what's in them is picture tiles you tick, the same tiles as
 * My Bar. Typed results are listed under the section each goes in.
 */
export function AddToBarSheet({ visible, filter, onFilter, onShelf, counts, onToggle, onClose }: AddToBarSheetProps) {
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
  const openRecipe = (id: string) => {
    onClose();
    router.push(itemHref('Ingredient', id) as never);
  };

  return (
    <MenuSheet
      visible={visible}
      onClose={onClose}
      title="Add to your bar"
      subtitle={onShelf.size ? `${onShelf.size} on your bar` : undefined}
      onShow={MODAL_AUTOFOCUS ? undefined : () => focusInModal(searchRef)}
    >
      <Field
        ref={searchRef}
        label="Search everything"
        value={query}
        onChangeText={setQuery}
        placeholder="Gin, lemons, malic acid, a shaker…"
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus={MODAL_AUTOFOCUS}
        returnKeyType="search"
      />
      <SectionChips sections={SHELF_SECTIONS} counts={counts} picked={filter === 'all' ? [] : [filter]} onPick={onFilter} bleed={space.xl} />
      <View style={styles.results}>
        <Caption tone="muted">{BLURBS[filter]}</Caption>
        {filter === 'kit' ? (
          <KitResults query={typed} cols={cols} />
        ) : !typed ? (
          <View style={styles.group}>
            <Caption tone="muted" style={styles.heading}>
              {filter === 'all' ? 'Most used in drinks' : `Common ${SECTIONS[filter].short.toLowerCase()}`}
            </Caption>
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
          <Body tone="muted">{found.isFetching || found.isPending ? 'Looking…' : `Nothing called “${typed}” yet. Try All, or snap the bottle.`}</Body>
        ) : (
          groups.map((g) => (
            <View key={g.section}>
              {filter === 'all' ? (
                <Caption tone="muted" style={styles.heading}>
                  {SECTIONS[g.section].title}
                </Caption>
              ) : null}
              {g.items.map((item) => (
                <Result
                  key={item.id}
                  name={item.name}
                  sub={item.section === 'preps' ? (onShelf.has(item.id) ? 'In your fridge' : 'House-made') : undefined}
                  thumb={<IngredientThumb id={item.id} name={item.name} size={48} />}
                  has={onShelf.has(item.id)}
                  onToggle={(on) => onToggle(item, on)}
                  extra={item.section === 'preps' ? <RecipeLink name={item.name} onPress={() => openRecipe(item.id)} /> : null}
                />
              ))}
            </View>
          ))
        )}
      </View>
    </MenuSheet>
  );
}

/** A house prep's recipe, to make it. */
function RecipeLink({ name, onPress }: { name: string; onPress: () => void }) {
  return (
    <PressableScale role="link" accessibilityLabel={`${name} recipe`} onPress={onPress} style={styles.recipe}>
      <Caption tone="accent">Recipe</Caption>
    </PressableScale>
  );
}

/** An idea to tick: on your bar shows a ring and a check. */
function IdeaTile({ item, has, onToggle }: { item: FoundItem; has: boolean; onToggle: AddToBarSheetProps['onToggle'] }) {
  const onLine = item.section === 'preps' ? 'In your fridge' : 'On your bar';
  return (
    <BarTile
      name={item.name}
      meta={has ? onLine : item.section === 'preps' ? 'House-made' : null}
      metaTone={has ? 'accent' : 'muted'}
      picture={<IngredientDrawing id={item.id} name={item.name} />}
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
function Result({ name, sub, thumb, has, onToggle, extra }: { name: string; sub?: string; thumb?: ReactNode; has: boolean; onToggle: (on: boolean) => void; extra?: ReactNode }) {
  const ds = useDs();
  return (
    <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <PressableScale role="checkbox" aria-checked={has} accessibilityLabel={name} accessibilityHint={has ? 'Takes it off your bar' : 'Puts it on your bar'} onPress={() => onToggle(!has)} style={styles.rowMain}>
        {thumb}
        <View style={styles.name}>
          <Headline numberOfLines={1}>{name}</Headline>
          {sub ? <Caption tone={has ? 'accent' : 'muted'}>{sub}</Caption> : null}
        </View>
        <IconSymbol name={has ? 'checkmark.circle.fill' : 'plus.circle'} size={26} color={has ? ds.accentText : ds.c.muted} />
      </PressableScale>
      {extra}
    </View>
  );
}

/** The equipment list as tiles by kind, searched by name: what you tick here is your kit. */
function KitResults({ query, cols }: { query: string; cols: number }) {
  const { owned, toggle } = useKit();
  const q = query.toLowerCase();
  const list = q ? EQUIPMENT.filter((e) => `${e.name} ${e.what}`.toLowerCase().includes(q)) : EQUIPMENT;
  if (!list.length) return <Body tone="muted">{`No kit called “${query}”.`}</Body>;
  return EQUIPMENT_KINDS.flatMap((kind) => {
    const pieces = list.filter((e) => e.kind === kind.id);
    if (!pieces.length) return [];
    return [
      <View key={kind.id} style={styles.group}>
        <Caption tone="muted" style={styles.heading}>
          {kind.name}
        </Caption>
        <TileGrid cols={cols}>
          {pieces.map((e) => {
            const has = owned.includes(e.id);
            return (
              <BarTile
                key={e.id}
                name={e.name}
                meta={has ? 'You have it' : null}
                metaTone="accent"
                picture={<EquipmentDrawing id={e.id} />}
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
  // Holds the sheet's height steady while results come and go.
  results: { minHeight: 320, gap: space.md },
  group: { gap: space.sm },
  heading: { paddingTop: space.md },
  withLink: { gap: 0 },
  recipe: { alignSelf: 'flex-start', minHeight: layout.minTapTarget, justifyContent: 'center' },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: space.xs },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingVertical: space.sm },
  name: { flex: 1, gap: 2 },
});
