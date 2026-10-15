import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Button, Caption, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';

interface SearchFieldProps {
  query: string;
  onQuery: (query: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  /** Return key: open the top result, or close the sheet. */
  onSubmit?: () => void;
  /** Shows Done beside the field (sheets), or the esc key cap inside it (the ⌘K palette, with `keys`). */
  onDone?: () => void;
  /** The ⌘K palette: an esc key cap at the field's end in place of Done. */
  keys?: boolean;
  /** The search tab: a round close button beside the field while it's in use, which empties it and puts the keyboard away. */
  cancel?: boolean;
  /** At the field's end, after the clear button: where it searches (ScopeToken). */
  token?: ReactNode;
  /** Hears the field gain and lose focus (Try it's bottom search moves with it). */
  onFocusChange?: (focused: boolean) => void;
}

/** A keyboard key, as the palette's hints draw it: "esc", "tab", "↵". */
export function KeyCap({ label }: { label: string }) {
  const ds = useDs();
  return (
    <View style={[styles.cap, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
      <Caption style={styles.capText}>{label}</Caption>
    </View>
  );
}

/**
 * The search pill: an accent ring while it's in use, a clear button once
 * something's typed. With `keys` (the ⌘K palette) it's the card's borderless
 * header instead, with the esc key at its end (nav-search-desk-palette).
 */
export function SearchField({ query, onQuery, placeholder, autoFocus, onSubmit, onDone, keys, cancel, token, onFocusChange }: SearchFieldProps) {
  const ds = useDs();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  // autoFocus alone loses to the button that opened the sheet, which keeps focus on web; focus once it has settled.
  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => input.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [autoFocus]);
  const cancelSearch = () => {
    onQuery('');
    input.current?.blur();
  };
  // react-native-web's TextInput stops every keydown from bubbling, so the overlays' window Escape never hears it from here.
  const onKeyPress = (e: { nativeEvent: { key: string } }) => {
    if (e.nativeEvent.key !== 'Escape') return;
    if (onDone) onDone();
    else if (cancel) cancelSearch();
  };
  return (
    <View style={styles.row}>
      <View style={[styles.field, keys ? styles.bare : { backgroundColor: ds.c.raised, borderColor: focused ? ds.accentText : ds.c.lineStrong }, token ? styles.withToken : null]}>
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
          onKeyPress={Platform.OS === 'web' ? onKeyPress : undefined}
          onFocus={() => {
            setFocused(true);
            onFocusChange?.(true);
          }}
          onBlur={() => {
            setFocused(false);
            onFocusChange?.(false);
          }}
          accessibilityLabel={placeholder}
          style={[styles.input, NO_OUTLINE, { color: ds.c.ink }]}
        />
        {query && !keys ? (
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
        {token}
        {keys && onDone ? (
          <PressableScale accessibilityLabel="Close the search (Escape)" onPress={onDone} style={styles.esc}>
            <KeyCap label="esc" />
          </PressableScale>
        ) : null}
      </View>
      {onDone && !keys ? <Button label="Done" variant="ghost" onPress={onDone} /> : null}
      {/* On the web the field blurs before the press lands: with nothing typed that's all Cancel would do anyway. */}
      {cancel && (focused || query) ? (
        <PressableScale role="button" accessibilityLabel="Cancel the search" onPress={cancelSearch} style={[styles.cancel, { backgroundColor: ds.c.raised, borderColor: ds.c.lineStrong }]}>
          <IconSymbol name="xmark" size={18} color={ds.c.ink} />
        </PressableScale>
      ) : null}
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
  bare: { borderWidth: 0, paddingLeft: 0 },
  withToken: { paddingRight: space.xs },
  input: { ...type.body, fontFamily: fontFamilies.body, flex: 1, minWidth: 0, paddingVertical: space.md },
  clear: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  esc: { minHeight: layout.minTapTarget, justifyContent: 'center', paddingRight: space.md },
  cancel: { width: layout.minTapTarget + space.xs, height: layout.minTapTarget + space.xs, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  cap: { borderWidth: 1, borderRadius: radius.mark, paddingHorizontal: space.sm - 2, minWidth: space.xl, alignItems: 'center' },
  capText: { fontFamily: fontFamilies.monoMedium },
});
