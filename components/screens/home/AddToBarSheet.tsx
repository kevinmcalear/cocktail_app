import { useRouter } from 'expo-router';
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, Headline, IngredientThumb, PressableScale, useDs } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { useBarSearch, type FoundItem } from '@/hooks/useHomeBar';
import { SECTIONS, type BarSection } from '@/lib/barSections';
import { COMMON_INGREDIENTS } from '@/lib/drinkWizard';
import { itemHref } from '@/lib/itemRoutes';
import { focusInModal, MODAL_AUTOFOCUS } from '@/lib/modalAutoFocus';
import { EQUIPMENT, TECHNICAL_INGREDIENTS } from '@/lib/techniques';
import { useKitStore } from '@/store/useKitStore';

export type AddFilter = 'all' | BarSection | 'kit';

const FILTERS: { value: AddFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'bottles', label: 'Bottles' },
  { value: 'fridge', label: 'Fridge' },
  { value: 'lab', label: 'Lab' },
  { value: 'preps', label: 'Preps' },
  { value: 'kit', label: 'Kit' },
];
const ORDER: BarSection[] = ['bottles', 'fridge', 'lab', 'preps'];

/** Ideas to tap before typing, for each filter. */
const IDEAS: Record<Exclude<AddFilter, 'kit'>, readonly string[]> = {
  all: COMMON_INGREDIENTS,
  bottles: COMMON_INGREDIENTS.filter((n) => !/juice|syrup|soda|egg/i.test(n)),
  fridge: ['Whole milk', 'Heavy cream', 'Pineapple', 'Coffee', 'Ginger', 'Cucumber', 'Grapefruit', 'Coconut cream', 'Tonic water'],
  lab: TECHNICAL_INGREDIENTS.map((t) => t.name.replace(/ \(.*\)$/, '')),
  preps: ['Simple syrup', 'Saline', 'Lime cordial', 'Oleo saccharum', 'Orgeat', 'Grenadine', 'Honey syrup', 'Acid solution'],
};

interface AddToBarSheetProps {
  visible: boolean;
  /** The filter it opens on, when a section's "Add" opened it. */
  filter: AddFilter;
  onFilter: (filter: AddFilter) => void;
  onShelf: Set<string>;
  onToggle: (item: FoundItem, add: boolean) => void;
  onClose: () => void;
}

/**
 * One search for everything on your bar: bottles, fridge, lab, house preps
 * and kit. Each result is listed under the section it goes in.
 */
export function AddToBarSheet({ visible, filter, onFilter, onShelf, onToggle, onClose }: AddToBarSheetProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const searchRef = useRef<ComponentRef<typeof TextInput>>(null);
  const typed = query.trim();
  const found = useBarSearch(filter === 'kit' ? '' : query);
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
        placeholder="Gin, lemons, malic acid, lime cordial…"
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus={MODAL_AUTOFOCUS}
        returnKeyType="search"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        <View role="radiogroup" accessibilityLabel="Show" style={styles.filters}>
          {FILTERS.map((f) => (
            <Chip key={f.value} label={f.label} quiet selected={filter === f.value} onPress={() => onFilter(f.value)} />
          ))}
        </View>
      </ScrollView>
      <View style={styles.results}>
        {filter === 'kit' ? (
          <KitResults query={typed} />
        ) : !typed ? (
          <View role="group" accessibilityLabel="Ideas" style={styles.chips}>
            {IDEAS[filter].map((name) => (
              <Chip key={name} label={name} selected={false} quiet onPress={() => setQuery(name)} />
            ))}
          </View>
        ) : found.error && !rows.length ? (
          <Body tone="muted">Couldn’t search right now. Check your connection and try again.</Body>
        ) : !rows.length ? (
          <Body tone="muted">{found.isFetching || found.isPending ? 'Looking…' : `Nothing called “${typed}” yet.`}</Body>
        ) : (
          groups.map((g) => (
            <View key={g.section}>
              {filter === 'all' ? (
                <Caption tone="muted" style={styles.group}>
                  {SECTIONS[g.section].title}
                </Caption>
              ) : null}
              {g.items.map((item) =>
                item.section === 'preps' ? (
                  <PrepResult key={item.id} item={item} has={onShelf.has(item.id)} onToggle={onToggle} onRecipe={openRecipe} />
                ) : (
                  <Result key={item.id} name={item.name} thumb={<IngredientThumb id={item.id} name={item.name} />} has={onShelf.has(item.id)} onToggle={(on) => onToggle(item, on)} />
                )
              )}
            </View>
          ))
        )}
      </View>
    </MenuSheet>
  );
}

/** A row you tick to have: the drawing, the name, and a check or a plus. */
function Result({ name, sub, thumb, has, onToggle }: { name: string; sub?: string; thumb?: ReactNode; has: boolean; onToggle: (on: boolean) => void }) {
  const ds = useDs();
  return (
    <PressableScale
      role="checkbox"
      aria-checked={has}
      accessibilityLabel={name}
      accessibilityHint={has ? 'Takes it off your bar' : 'Puts it on your bar'}
      onPress={() => onToggle(!has)}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      {thumb}
      <View style={styles.name}>
        <Headline numberOfLines={1}>{name}</Headline>
        {sub ? (
          <Caption tone="muted" numberOfLines={2}>
            {sub}
          </Caption>
        ) : null}
      </View>
      <IconSymbol name={has ? 'checkmark.circle.fill' : 'plus.circle'} size={26} color={has ? ds.accentText : ds.c.muted} />
    </PressableScale>
  );
}

/** A house prep: say you have some, or open its recipe to make it. */
function PrepResult({ item, has, onToggle, onRecipe }: { item: FoundItem; has: boolean; onToggle: AddToBarSheetProps['onToggle']; onRecipe: (id: string) => void }) {
  const ds = useDs();
  return (
    <View style={[styles.row, styles.prep, { borderBottomColor: ds.c.line }]}>
      <IngredientThumb id={item.id} name={item.name} />
      <View style={[styles.name, styles.prepBody]}>
        <View>
          <Headline numberOfLines={1}>{item.name}</Headline>
          <Caption tone={has ? 'accent' : 'muted'}>{has ? 'In your fridge' : 'House-made'}</Caption>
        </View>
        <View style={styles.prepActions}>
          <Button label={has ? 'Used it up' : 'I have some'} variant="secondary" onPress={() => onToggle(item, !has)} />
          <Button label="Recipe" variant="ghost" onPress={() => onRecipe(item.id)} />
        </View>
      </View>
    </View>
  );
}

/** The equipment list, searched by name: what you tick here is your kit. */
function KitResults({ query }: { query: string }) {
  const owned = useKitStore((s) => s.owned);
  const toggle = useKitStore((s) => s.toggle);
  const q = query.toLowerCase();
  const list = q ? EQUIPMENT.filter((e) => `${e.name} ${e.what}`.toLowerCase().includes(q)) : EQUIPMENT;
  if (!list.length) return <Body tone="muted">{`No kit called “${query}”.`}</Body>;
  return list.map((e) => (
    <Result key={e.id} name={e.name} sub={e.what} has={owned.includes(e.id)} onToggle={() => toggle(e.id)} />
  ));
}

const styles = StyleSheet.create({
  // Holds the sheet's height steady while results come and go.
  results: { minHeight: 320 },
  filters: { flexDirection: 'row', gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  group: { paddingTop: space.lg, paddingBottom: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { flex: 1, gap: 2 },
  prep: { alignItems: 'flex-start' },
  prepBody: { gap: space.sm },
  prepActions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
});
