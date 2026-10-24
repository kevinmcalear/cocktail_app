import { Platform, StyleSheet, View } from 'react-native';
import DraggableFlatList, { NestableDraggableFlatList, ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Body, Caption, DsText, Headline, IngredientThumb, PressableScale, useDs } from '@/components/ds';
import { dragGripStyle, gripOnly, supportsNestableDrag } from '@/components/recipe/FormScrollContainer';
import type { SortableRecipeItem } from '@/lib/recipeItem';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { STATUS } from '@/constants/palette';
import { backbar, fontFamilies, layout, radius, space } from '@/constants/tokens';
import { amountText } from '@/lib/units';

const GRIP = 32;
const List = supportsNestableDrag ? NestableDraggableFlatList : DraggableFlatList;
const web = Platform.OS === 'web';

interface EditSpecListProps {
  items: SortableRecipeItem[];
  onReorder: (items: SortableRecipeItem[]) => void;
  onRemove: (index: number) => void;
  /** The amount: opens the spec pad on that line. */
  onAmount: (index: number) => void;
  /** The name: swap the ingredient. */
  onSwap: (index: number) => void;
  onAdd: () => void;
  /** A house prep's list is its Recipe, with what a batch makes beside it. */
  title?: string;
  aside?: string | null;
  /** Said after how to reorder and remove ("The 3 drinks that use it update when you press Done."). */
  note?: string | null;
}

// Rows have no id until they're saved; the ingredient and its place keep them apart meanwhile.
const keyOf = (item: SortableRecipeItem, index: number) => item.id ?? `${item.ingredient_id}-${index}`;

/**
 * The spec while editing (drink-edit-phone): each line as it reads, with a
 * grip to reorder, its amount a button that opens the spec pad, and a swipe
 * left to remove it (the web shows an x). A dashed row at the end adds one.
 */
export function EditSpecList({ items, onReorder, onRemove, onAmount, onSwap, onAdd, title = 'Spec', aside, note: after }: EditSpecListProps) {
  const ds = useDs();
  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<SortableRecipeItem>) => {
    const i = getIndex() ?? 0;
    const amount = item.amount ? amountText(item.amount, item.unit) : 'Amount';
    const note = [item.preparation_notes, item.is_optional ? 'optional' : null].filter(Boolean).join(', ');
    const row = (
      <View style={[styles.row, { borderBottomColor: ds.c.line, backgroundColor: isActive ? ds.c.raised : ds.c.ground }]}>
        <PressableScale
          role="button"
          accessibilityLabel={`Reorder ${item.name}`}
          onLongPress={web ? undefined : drag}
          onPressIn={web ? drag : undefined}
          style={[styles.grip, dragGripStyle]}
        >
          <IconSymbol name="line.3.horizontal" size={18} color={ds.c.muted} />
        </PressableScale>
        <PressableScale
          role="button"
          accessibilityLabel={`Amount, ${amount}. Change it`}
          onPress={() => onAmount(i)}
          style={[styles.amount, { backgroundColor: ds.c.surface, borderColor: ds.c.lineStrong }]}
        >
          <DsText variant="label" color={item.amount ? ds.accentText : ds.c.muted} numberOfLines={1} style={styles.mono}>
            {amount}
          </DsText>
        </PressableScale>
        <PressableScale role="button" accessibilityLabel={`${item.name}. Swap it`} onPress={() => onSwap(i)} style={styles.what}>
          <IngredientThumb id={item.ingredient_id} name={item.name} size={44} />
          <View style={styles.flex}>
            <Body numberOfLines={1}>{item.name}</Body>
            {note ? (
              <Caption tone="muted" numberOfLines={1}>
                {note}
              </Caption>
            ) : null}
          </View>
        </PressableScale>
        {web ? (
          <PressableScale role="button" accessibilityLabel={`Remove ${item.name}`} onPress={() => onRemove(i)} style={styles.remove}>
            <IconSymbol name="xmark" size={16} color={ds.c.muted} />
          </PressableScale>
        ) : null}
      </View>
    );
    return (
      <ScaleDecorator>
        {web ? (
          row
        ) : (
          <Swipeable
            friction={2}
            rightThreshold={48}
            // Opaque, or the action shows through the row while it's closed (RNGH 3).
            childrenContainerStyle={{ backgroundColor: ds.c.ground }}
            renderRightActions={() => (
              <PressableScale role="button" accessibilityLabel={`Remove ${item.name}`} onPress={() => onRemove(i)} style={[styles.swipeAction, { backgroundColor: STATUS.danger }]}>
                <IconSymbol name="minus" size={20} color={backbar.dark.ink} />
                <DsText variant="label" color={backbar.dark.ink}>
                  Remove
                </DsText>
              </PressableScale>
            )}
          >
            <View accessible={false} accessibilityActions={[{ name: 'remove', label: `Remove ${item.name}` }]} onAccessibilityAction={() => onRemove(i)}>
              {row}
            </View>
          </Swipeable>
        )}
      </ScaleDecorator>
    );
  };

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Headline role="heading">{title}</Headline>
        {aside ? <Caption tone="muted">{aside}</Caption> : null}
      </View>
      <List data={items} keyExtractor={keyOf} renderItem={renderItem} onDragEnd={({ data }) => onReorder(data)} activationDistance={8} dragHitSlop={gripOnly(GRIP)} />
      <PressableScale role="button" accessibilityLabel={`Add a line to the ${title.toLowerCase()}`} onPress={onAdd} style={[styles.add, { borderColor: ds.c.lineStrong }]}>
        <IconSymbol name="plus" size={18} color={ds.accentText} />
        <Body style={[styles.flex, styles.medium]}>Add a line</Body>
      </PressableScale>
      <Caption tone="muted">{[web ? 'Drag a grip to reorder.' : 'Hold a grip to reorder. Swipe a line left to remove it.', after].filter(Boolean).join(' ')}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 68, borderBottomWidth: StyleSheet.hairlineWidth },
  grip: { width: GRIP, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  amount: { width: 84, minHeight: 40, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xs },
  mono: { fontFamily: fontFamilies.monoMedium },
  what: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget },
  flex: { flex: 1, minWidth: 0 },
  medium: { fontFamily: fontFamilies.bodyMedium },
  remove: { width: 32, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  swipeAction: { width: 96, alignItems: 'center', justifyContent: 'center', gap: 2 },
  add: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52, paddingHorizontal: space.md, borderRadius: radius.control, borderWidth: 1.5, borderStyle: 'dashed', marginTop: space.xs },
});
