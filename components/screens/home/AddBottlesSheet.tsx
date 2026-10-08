import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Chip, Field, Headline, IngredientThumb, PressableScale, useDs } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { useBottleSearch, type BarItem } from '@/hooks/useHomeBar';
import { COMMON_INGREDIENTS } from '@/lib/drinkWizard';
import { focusInModal, MODAL_AUTOFOCUS } from '@/lib/modalAutoFocus';

interface AddBottlesSheetProps {
  visible: boolean;
  onShelf: Set<string>;
  onToggle: (item: BarItem, add: boolean) => void;
  onClose: () => void;
}

/** Search the ingredients you can see and put bottles on your shelf. */
export function AddBottlesSheet({ visible, onShelf, onToggle, onClose }: AddBottlesSheetProps) {
  const [query, setQuery] = useState('');
  const searchRef = useRef<ComponentRef<typeof TextInput>>(null);
  const found = useBottleSearch(query);
  const typed = query.trim();
  // Results for older text stay up while the new search runs, so only an empty list waits.
  const rows = typed ? (found.data ?? []) : [];

  return (
    <MenuSheet
      visible={visible}
      onClose={onClose}
      title="Add bottles"
      subtitle={onShelf.size ? `${onShelf.size} on your shelf` : undefined}
      onShow={MODAL_AUTOFOCUS ? undefined : () => focusInModal(searchRef)}
    >
      <Field
        ref={searchRef}
        label="Search ingredients"
        value={query}
        onChangeText={setQuery}
        placeholder="Gin, Campari, lemons…"
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus={MODAL_AUTOFOCUS}
        returnKeyType="search"
      />
      <View style={styles.results}>
        {!typed ? (
          <View role="group" accessibilityLabel="Common bottles" style={styles.chips}>
            {COMMON_INGREDIENTS.map((name) => (
              <Chip key={name} label={name} selected={false} quiet onPress={() => setQuery(name)} />
            ))}
          </View>
        ) : found.error && !rows.length ? (
          <Body tone="muted">Couldn’t search right now. Check your connection and try again.</Body>
        ) : !rows.length ? (
          <Body tone="muted">{found.isFetching || found.isPending ? 'Looking…' : `No ingredient called “${typed}” yet.`}</Body>
        ) : (
          rows.map((item) => <BottleRow key={item.id} item={item} has={onShelf.has(item.id)} onToggle={onToggle} />)
        )}
      </View>
    </MenuSheet>
  );
}

function BottleRow({ item, has, onToggle }: { item: BarItem; has: boolean; onToggle: AddBottlesSheetProps['onToggle'] }) {
  const ds = useDs();
  return (
    <PressableScale
      role="checkbox"
      aria-checked={has}
      accessibilityLabel={item.name}
      accessibilityHint={has ? 'Takes it off your shelf' : 'Puts it on your shelf'}
      onPress={() => onToggle(item, !has)}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      <IngredientThumb name={item.name} url={item.imageUrl} />
      <Headline numberOfLines={1} style={styles.name}>
        {item.name}
      </Headline>
      <IconSymbol name={has ? 'checkmark.circle.fill' : 'plus.circle'} size={26} color={has ? ds.accentText : ds.c.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // Holds the sheet's height steady while results come and go.
  results: { minHeight: 320 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { flex: 1 },
});
