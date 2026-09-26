import { useMemo, useState } from 'react';
import { FlatList, Modal, Platform, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Headline, PressableScale, Title, useDs, useGutter } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space, type } from '@/constants/tokens';
import type { BarItem } from '@/hooks/useHomeBar';

interface AddBottlesSheetProps {
  visible: boolean;
  bottles: BarItem[];
  onShelf: Set<string>;
  onToggle: (item: BarItem, add: boolean) => void;
  onClose: () => void;
}

/** Search the ingredients you can see and put bottles on your shelf. */
export function AddBottlesSheet({ visible, bottles, onShelf, onToggle, onClose }: AddBottlesSheetProps) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? bottles.filter((b) => b.name.toLowerCase().includes(q)) : bottles;
  }, [bottles, query]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: ds.c.ground, paddingTop: Platform.OS === 'ios' ? space.lg : insets.top + space.lg }]}>
        <View style={[styles.head, { paddingHorizontal: gutter }]}>
          <Title>Add bottles</Title>
          <Button label="Done" variant="secondary" onPress={onClose} />
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search gin, Campari, lemons…"
          placeholderTextColor={ds.c.muted}
          autoCorrect={false}
          autoFocus
          accessibilityLabel="Search ingredients"
          style={[styles.search, { marginHorizontal: gutter, color: ds.c.ink, backgroundColor: ds.c.raised, borderColor: ds.c.line }]}
        />
        <FlatList
          data={shown}
          keyExtractor={(b) => b.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xl }}
          ListEmptyComponent={<Body tone="muted">No ingredient called “{query}” yet.</Body>}
          renderItem={({ item }) => {
            const has = onShelf.has(item.id);
            return (
              <PressableScale
                role="checkbox"
                aria-checked={has}
                accessibilityLabel={item.name}
                accessibilityHint={has ? 'Takes it off your shelf' : 'Puts it on your shelf'}
                onPress={() => onToggle(item, !has)}
                style={[styles.row, { borderBottomColor: ds.c.line }]}
              >
                <Headline numberOfLines={1} style={styles.name}>
                  {item.name}
                </Headline>
                <IconSymbol
                  name={has ? 'checkmark.circle.fill' : 'plus.circle'}
                  size={26}
                  color={has ? ds.accentText : ds.c.muted}
                />
              </PressableScale>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  search: {
    ...type.body,
    fontFamily: fontFamilies.body,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { flex: 1 },
});
