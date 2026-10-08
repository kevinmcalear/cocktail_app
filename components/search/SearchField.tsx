import { useEffect, useRef, type ComponentRef } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Button, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';

interface SearchFieldProps {
  query: string;
  onQuery: (query: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  /** Return key: open the top result, or close the sheet. */
  onSubmit?: () => void;
  /** Shows Done beside the field (sheets and the ⌘K palette). */
  onDone?: () => void;
}

/** The search pill: an accent ring while it's in use, a clear button once something's typed. */
export function SearchField({ query, onQuery, placeholder, autoFocus, onSubmit, onDone }: SearchFieldProps) {
  const ds = useDs();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  // autoFocus alone loses to the button that opened the sheet, which keeps focus on web; focus once it has settled.
  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => input.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [autoFocus]);
  return (
    <View style={styles.row}>
      <View style={[styles.field, { backgroundColor: ds.c.raised, borderColor: ds.accentText }]}>
        <IconSymbol name="magnifyingglass" size={18} color={ds.c.muted} />
        <TextInput
          ref={input}
          value={query}
          onChangeText={onQuery}
          placeholder={placeholder}
          placeholderTextColor={ds.c.muted}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={onSubmit}
          accessibilityLabel={placeholder}
          style={[styles.input, NO_OUTLINE, { color: ds.c.ink }]}
        />
        {query ? (
          <PressableScale
            accessibilityLabel="Clear the search"
            onPress={() => {
              onQuery('');
              input.current?.focus();
            }}
            style={styles.clear}
          >
            <IconSymbol name="xmark.circle.fill" size={22} color={ds.c.muted} />
          </PressableScale>
        ) : null}
      </View>
      {onDone ? <Button label="Done" variant="ghost" onPress={onDone} /> : null}
    </View>
  );
}

// The field's accent border shows focus. Chrome draws `outline-style: auto` at any width, so it's switched off.
const NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: layout.minTapTarget + space.xs,
    paddingLeft: space.lg,
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  input: { ...type.body, fontFamily: fontFamilies.body, flex: 1, minWidth: 0, paddingVertical: space.md },
  clear: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
