import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Body, IngredientThumb, PressableScale, Tag, useDs } from '@/components/ds';
import { dragGripStyle } from '@/components/recipe/FormScrollContainer';
import { UnitPicker } from '@/components/recipe/UnitPicker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { STATUS } from '@/constants/palette';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { isDefaultBatchName } from '@/lib/mergeRecipeItems';
import { capitalizeFirst } from '@/lib/stringUtils';
import { useSettingsStore } from '@/store/useSettingsStore';

import type { SortableRecipeItem } from './SortableRecipeList';

/** The grip's width: the list's dragHitSlop starts a drag only here. */
export const RECIPE_GRIP = 32;
const web = Platform.OS === 'web';

interface RecipeRowProps {
  item: SortableRecipeItem;
  index: number;
  drag: () => void;
  isActive: boolean;
  isMergeTarget: boolean;
  isMergePending: boolean;
  /** Changes when a line is added: focus its amount. */
  autoFocusKey?: number;
  /** Changes when a batch line is made: rename it. */
  autoFocusNameKey?: number;
  onUpdateItem: (index: number, updates: Partial<SortableRecipeItem>) => void;
  onRemove: (index: number) => void;
  onRenameIngredient?: (ingredientId: string, name: string) => void;
  onOpen?: (ingredientId: string) => void;
  draftBadge: ReactNode;
}

/**
 * One line of a prep's recipe (make-create-house-line): a grip, the drawing,
 * the name (tap to rename), its amount and unit pills, and an x to remove it.
 * Held over another line while dragging, it shows that the two will combine.
 */
export function RecipeRow({ item, index, drag, isActive, isMergeTarget, isMergePending, autoFocusKey, autoFocusNameKey, onUpdateItem, onRemove, onRenameIngredient, onOpen, draftBadge }: RecipeRowProps) {
  const ds = useDs();
  const defaultUnit = useSettingsStore((s) => s.defaultUnit);
  const amountRef = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (!autoFocusKey) return;
    const t = setTimeout(() => amountRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [autoFocusKey]);

  const merge = isMergeTarget
    ? [styles.merging, styles.mergeTarget, { borderColor: STATUS.warning, backgroundColor: withAlpha(STATUS.warning, 0.18) }]
    : isMergePending
      ? [styles.merging, { borderColor: withAlpha(STATUS.warning, 0.55), backgroundColor: withAlpha(STATUS.warning, 0.08) }]
      : null;

  return (
    <View style={[styles.row, { borderBottomColor: ds.c.line }, isActive && { backgroundColor: ds.c.raised }, merge]}>
      <PressableScale
        role="button"
        accessibilityLabel={`Reorder ${item.name}`}
        onLongPress={web ? undefined : drag}
        onPressIn={web ? drag : undefined}
        disabled={isActive}
        style={[styles.grip, dragGripStyle]}
      >
        <IconSymbol name="line.3.horizontal" size={18} color={ds.c.muted} />
      </PressableScale>
      <IngredientThumb id={item.ingredient_id} name={item.name} size={40} />
      <View style={styles.main}>
        <RecipeName item={item} index={index} autoFocusNameKey={autoFocusNameKey} onUpdateItem={onUpdateItem} onRenameIngredient={onRenameIngredient} onOpen={onOpen} draftBadge={draftBadge} />
        <View style={styles.measure}>
          <TextInput
            ref={amountRef}
            value={item.amount}
            onChangeText={(v) => onUpdateItem(index, { amount: v })}
            placeholder="Amount"
            placeholderTextColor={ds.c.muted}
            accessibilityLabel={`Amount of ${item.name}`}
            style={[styles.amount, { color: ds.c.ink, backgroundColor: ds.c.raised }]}
          />
          <UnitPicker value={item.unit || defaultUnit} onChange={(unit) => onUpdateItem(index, { unit })} />
        </View>
      </View>
      <PressableScale role="button" accessibilityLabel={`Remove ${item.name}`} onPress={() => onRemove(index)} style={styles.remove}>
        <IconSymbol name="xmark" size={16} color={ds.c.muted} />
      </PressableScale>
      {isMergeTarget || isMergePending ? <Tag label={isMergeTarget ? 'Release to combine' : 'Hold to combine…'} tone="warning" style={styles.mergeHint} /> : null}
    </View>
  );
}

interface RecipeNameProps {
  item: SortableRecipeItem;
  index: number;
  autoFocusNameKey?: number;
  onUpdateItem: (index: number, updates: Partial<SortableRecipeItem>) => void;
  onRenameIngredient?: (ingredientId: string, name: string) => void;
  onOpen?: (ingredientId: string) => void;
  draftBadge: ReactNode;
}

/** The line's name: tap to rename the ingredient itself, and a chevron to open it. */
function RecipeName({ item, index, autoFocusNameKey, onUpdateItem, onRenameIngredient, onOpen, draftBadge }: RecipeNameProps) {
  const ds = useDs();
  const [editing, setEditing] = useState(!!autoFocusNameKey);
  const [seenKey, setSeenKey] = useState(autoFocusNameKey);
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const committedNameRef = useRef(item.name);
  // A new key (a batch line was just made): straight into renaming it.
  if (autoFocusNameKey !== seenKey) {
    setSeenKey(autoFocusNameKey);
    if (autoFocusNameKey) setEditing(true);
  }

  useEffect(() => {
    if (!editing) committedNameRef.current = item.name;
  }, [item.name, editing]);

  useEffect(() => {
    if (!autoFocusNameKey) return;
    const t = setTimeout(() => nameRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [autoFocusNameKey]);

  const commitName = () => {
    setEditing(false);
    const next = capitalizeFirst(item.name);
    if (!next) {
      onUpdateItem(index, { name: committedNameRef.current });
      return;
    }
    if (next !== item.name) onUpdateItem(index, { name: next });
    if (next !== committedNameRef.current) {
      committedNameRef.current = next;
      onRenameIngredient?.(item.ingredient_id, next);
    }
  };

  if (editing) {
    return (
      <TextInput
        ref={nameRef}
        value={item.name}
        onChangeText={(v) => onUpdateItem(index, { name: v })}
        placeholder="Ingredient name"
        placeholderTextColor={ds.c.muted}
        accessibilityLabel="Ingredient name"
        style={[styles.nameInput, { color: ds.c.ink }]}
        returnKeyType="done"
        onSubmitEditing={commitName}
        onBlur={commitName}
        selectTextOnFocus={isDefaultBatchName(item.name)}
      />
    );
  }

  return (
    <View style={styles.nameRow}>
      <PressableScale role="button" accessibilityLabel={`${item.name}. Rename it`} onPress={() => setEditing(true)} style={styles.name}>
        <Body numberOfLines={1}>{item.name}</Body>
      </PressableScale>
      {draftBadge}
      {onOpen ? (
        <PressableScale role="button" accessibilityLabel={`Open ${item.name}`} onPress={() => onOpen(item.ingredient_id)} style={styles.open}>
          <IconSymbol name="chevron.right" size={14} color={ds.c.muted} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  merging: { borderWidth: 1.5, borderRadius: radius.control, borderBottomWidth: 1.5 },
  mergeTarget: { borderWidth: 2, borderBottomWidth: 2, transform: [{ scale: 1.04 }] },
  mergeHint: { position: 'absolute', right: space.sm, top: space.xs, zIndex: 2 },
  grip: { width: RECIPE_GRIP, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, minWidth: 0, gap: space.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 40 },
  name: { flexShrink: 1, minWidth: 0, minHeight: 40, justifyContent: 'center' },
  nameInput: { ...type.body, fontFamily: fontFamilies.body, minHeight: 40, padding: 0, margin: 0, backgroundColor: 'transparent', borderWidth: 0, minWidth: 0 },
  open: { width: 32, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  measure: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  amount: { ...type.spec, fontFamily: fontFamilies.monoMedium, width: 88, height: layout.minTapTarget, paddingHorizontal: space.md, borderRadius: radius.pill, textAlign: 'center' },
  remove: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
