import { useState, type ComponentRef, type Ref } from 'react';
import { ScrollView, StyleSheet, View, type TextInput, type ViewStyle } from 'react-native';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';
import type { TamaguiElement } from 'tamagui';

import { Body, Caption, Chip, Field, FieldButton, PressableScale, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';

export interface SearchChip {
  id: string;
  label: string;
  type: string;
}

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  style?: ViewStyle;
  placeholder?: string;
  onFilterPress?: () => void;
  chips?: SearchChip[];
  onRemoveChip?: (id: string) => void;
  suggestions?: SearchChip[];
  onSuggestionPress?: (suggestion: SearchChip) => void;
  /**
   * ponytail: ignored. It swapped in @gorhom's sheet input, and no gorhom sheet
   * hosts a search bar any more (sheets are ds Sheet). Drop it with the last caller.
   */
  isBottomSheet?: boolean;
  autoFocus?: boolean;
  /** The input, e.g. to focus it when a Modal opens. */
  ref?: Ref<TamaguiElement>;
}

/** A search box in the Back Bar style (a ds Field with the magnifier), with optional filter chips and suggestions under it. */
export function SearchBar({
  value,
  onChangeText,
  style,
  placeholder = 'Find your drink...',
  onFilterPress,
  chips = [],
  onRemoveChip,
  suggestions = [],
  onSuggestionPress,
  autoFocus = false,
  ref,
}: SearchBarProps) {
  const ds = useDs();
  const [isFocused, setIsFocused] = useState(false);
  const clear = value.length > 0 ? <FieldButton icon="xmark.circle.fill" label="Clear search" onPress={() => onChangeText('')} /> : null;
  const filter = onFilterPress ? <FieldButton icon="line.3.horizontal.decrease" label="Filters" onPress={onFilterPress} /> : null;
  return (
    <View style={[styles.bar, style]}>
      <Field
        // ponytail: callers hold a Tamagui ref (TamaguiElement types the RN View, not the input); both focus() and blur().
        ref={ref as unknown as Ref<ComponentRef<typeof TextInput>>}
        label={placeholder}
        hideLabel
        icon="magnifyingglass"
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        autoFocus={autoFocus}
        onFocus={() => setIsFocused(true)}
        // Late, so a tap on a suggestion lands before the list goes.
        onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        trailing={clear || filter ? <>{clear}{filter}</> : undefined}
      />
      {chips.length > 0 ? (
        <View role="group" aria-label="Filters" style={styles.chips}>
          {chips.map((chip) => (
            <Animated.View key={`chip-${chip.id}`} entering={ZoomIn.duration(250)} exiting={ZoomOut.duration(250)}>
              <Chip label={chip.label} selected multi accessibilityLabel={`Remove ${chip.label}`} onPress={() => onRemoveChip?.(chip.id)} />
            </Animated.View>
          ))}
        </View>
      ) : null}

      {isFocused && suggestions.length > 0 ? (
        <View style={[styles.suggestions, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
          <ScrollView style={styles.suggestionScroll} keyboardShouldPersistTaps="handled">
            {suggestions.map((item, index) => (
              <PressableScale
                key={`sug-${item.type}-${item.id}-${index}`}
                accessibilityLabel={`${item.label}, ${item.type}`}
                onPress={() => onSuggestionPress?.(item)}
                style={[styles.suggestion, index < suggestions.length - 1 ? { borderBottomColor: ds.c.line, borderBottomWidth: StyleSheet.hairlineWidth } : null]}
              >
                <Body numberOfLines={1} style={styles.suggestionLabel}>
                  {item.label}
                </Body>
                <Caption tone="muted">{item.type.toUpperCase()}</Caption>
              </PressableScale>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { zIndex: 50 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  suggestions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
  },
  suggestionScroll: { maxHeight: 220 },
  suggestion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg },
  suggestionLabel: { flexShrink: 1 },
});
