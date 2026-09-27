import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DrinkImage, Field, Headline, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { cannotAdd, filterLibrary, libraryNote, type EditSection } from '@/lib/menuLayout';
import { sectionRule } from '@/lib/menus';
import type { MenuDrink } from '@/types/menus';

import { Choice, MenuSheet } from './MenuSheet';

const CREATE_ROUTE: Record<MenuDrink['kind'], Href> = { cocktail: '/add-cocktail', beer: '/add-beer', wine: '/add-wine' };

interface AddDrinkSheetProps {
  section: EditSection | null;
  onClose: () => void;
  library: MenuDrink[];
  /** Which other menu each drink is on (on now or coming up), by drink id. */
  elsewhere: Record<string, string>;
  onAdd: (drink: MenuDrink) => void;
}

/** One drink in the library, with what adding it would do. */
export function LibraryRow({ drink, note, added, onAdd }: { drink: MenuDrink; note: string; added: boolean; onAdd?: () => void }) {
  const ds = useDs();
  return (
    <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <View style={styles.thumb}>
        <DrinkImage source={drink.imageUrl} generated={drink.isSketch} glass={drink.glass} accessibilityLabel={drink.name} radius="control" hideTag />
      </View>
      <View style={styles.flex}>
        <Headline numberOfLines={1}>{drink.name}</Headline>
        <Caption tone="muted" numberOfLines={1}>
          {note}
        </Caption>
      </View>
      {added ? (
        <View accessible role="img" accessibilityLabel="Added" style={[styles.add, { backgroundColor: withAlpha(ds.accentText, 0.16) }]}>
          <IconSymbol name="checkmark" size={18} color={ds.accentText} />
        </View>
      ) : onAdd ? (
        <PressableScale accessibilityLabel={`Add ${drink.name}`} onPress={onAdd} style={[styles.add, { backgroundColor: ds.c.raised }]}>
          <IconSymbol name="plus" size={18} color={ds.c.ink} />
        </PressableScale>
      ) : null}
    </View>
  );
}

export function AddDrinkSheet({ section, onClose, library, elsewhere, onAdd }: AddDrinkSheetProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);
  if (!section) return null;
  const drinks = filterLibrary(library, section, query, freeOnly, elsewhere);
  const kind = section.allowedTypes[0] ?? 'cocktail';

  return (
    <MenuSheet
      visible
      onClose={onClose}
      title={`Add to ${section.name}`}
      subtitle={`${sectionRule(section)} · ${section.drinks.length} in`}
      footer={
        <>
          <Button
            label={`Create a new ${kind === 'cocktail' ? 'drink' : kind}`}
            icon="plus"
            variant="secondary"
            onPress={() => {
              onClose();
              router.push(CREATE_ROUTE[kind]);
            }}
          />
          {/* ponytail: a new drink doesn't land in the section by itself yet; it shows up here to add. */}
          <Caption tone="muted" align="center">
            Once it’s saved, add it from this list.
          </Caption>
        </>
      }
    >
      <Field label="Search" value={query} onChangeText={setQuery} placeholder="Search the venue’s drinks" autoCapitalize="none" />
      <View role="radiogroup" accessibilityLabel="Show" style={styles.filters}>
        <Choice label="All" selected={!freeOnly} onPress={() => setFreeOnly(false)} />
        <Choice label="Not on a menu" selected={freeOnly} onPress={() => setFreeOnly(true)} />
      </View>
      {drinks.length === 0 ? (
        <Body tone="muted">{query ? `Nothing called “${query}” that fits ${section.name}.` : `No drinks that fit ${section.name} yet.`}</Body>
      ) : (
        drinks.map((d) => (
          <LibraryRow
            key={d.id}
            drink={d}
            note={libraryNote(d, section, elsewhere)}
            added={!!cannotAdd(section, d)}
            onAdd={() => onAdd(d)}
          />
        ))
      )}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 48 },
  flex: { flex: 1, gap: 2 },
  add: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
