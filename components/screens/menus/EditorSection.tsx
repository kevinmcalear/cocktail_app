import { Platform, StyleSheet, View } from 'react-native';
import DraggableFlatList, { NestableDraggableFlatList, type RenderItemParams } from 'react-native-draggable-flatlist';

import { Caption, DrinkImage, DsText, Headline, PressableScale, useBreakpoint, useDs } from '@/components/ds';
import { supportsNestableDrag } from '@/components/recipe/FormScrollContainer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import type { EditSection } from '@/lib/menuLayout';
import { formatPrice, sectionRule } from '@/lib/menus';
import type { MenuDrink } from '@/types/menus';

interface EditorSectionProps {
  section: EditSection;
  /** The section new drinks go into on desktop (clicking one in the library). */
  targeted?: boolean;
  onTarget?: () => void;
  onAdd: () => void;
  onSettings: () => void;
  /** A home menu: the drink's line, not venue warnings about photos and prices. */
  home?: boolean;
  onRemove: (drinkId: string) => void;
  onReorder: (drinks: MenuDrink[]) => void;
  onMove: (from: number, to: number) => void;
}

function status(drink: MenuDrink, home?: boolean): { text: string; warn: boolean } {
  if (home) return { text: drink.line, warn: false };
  const price = formatPrice(drink.price);
  if (!drink.imageUrl || drink.isSketch) return { text: drink.imageUrl ? 'Sketch: needs a photo' : 'Needs a photo', warn: true };
  if (!price) return { text: 'No price yet', warn: true };
  return { text: `Ready · ${price}`, warn: false };
}

const ListComponent = supportsNestableDrag ? NestableDraggableFlatList : DraggableFlatList;

/** One section being edited: its rule, its drinks in order (drag to reorder), and adding more. */
export function EditorSection({ section, targeted, onTarget, onAdd, onSettings, home, onRemove, onReorder, onMove }: EditorSectionProps) {
  const ds = useDs();
  // Web from tablet width up: buttons to move a drink, for keyboards and mice.
  const breakpoint = useBreakpoint();
  const moveButtons = Platform.OS === 'web' && breakpoint !== 'phone';
  const count = section.drinks.length;
  const short = section.minItems - count;
  const over = section.maxItems !== null ? count - section.maxItems : 0;
  const note = short > 0 ? `Needs ${short} more` : over > 0 ? `${over} too many` : `${sectionRule(section)} · ${count} in`;

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<MenuDrink>) => {
    const i = getIndex() ?? 0;
    const s = status(item, home);
    return (
      <View style={[styles.row, { borderBottomColor: ds.c.line, backgroundColor: isActive ? ds.c.raised : ds.c.ground }]}>
        <PressableScale
          accessibilityLabel={`Reorder ${item.name}`}
          accessibilityHint="Drag, or use the actions to move it up or down"
          accessibilityActions={[{ name: 'moveUp', label: 'Move up' }, { name: 'moveDown', label: 'Move down' }]}
          onAccessibilityAction={(e) => onMove(i, e.nativeEvent.actionName === 'moveUp' ? i - 1 : i + 1)}
          onLongPress={Platform.OS === 'web' ? undefined : drag}
          onPressIn={Platform.OS === 'web' ? drag : undefined}
          disabled={isActive}
          style={styles.grip}
        >
          <IconSymbol name="line.3.horizontal" size={18} color={ds.c.muted} />
        </PressableScale>
        <View style={styles.thumb}>
          <DrinkImage source={item.imageUrl} generated={item.isSketch} glass={item.glass} accessibilityLabel={item.name} radius="control" hideTag />
        </View>
        <View style={styles.flex}>
          <Headline numberOfLines={2}>{item.name}</Headline>
          <Caption tone={s.warn ? 'accent' : 'muted'} numberOfLines={1}>
            {s.text}
          </Caption>
        </View>
        {moveButtons ? (
          <>
            <PressableScale accessibilityLabel={`Move ${item.name} up`} aria-disabled={i === 0} disabled={i === 0} onPress={() => onMove(i, i - 1)} style={[styles.icon, i === 0 && styles.off]}>
              <IconSymbol name="chevron.up" size={16} color={ds.c.muted} />
            </PressableScale>
            <PressableScale accessibilityLabel={`Move ${item.name} down`} aria-disabled={i === count - 1} disabled={i === count - 1} onPress={() => onMove(i, i + 1)} style={[styles.icon, i === count - 1 && styles.off]}>
              <IconSymbol name="chevron.down" size={16} color={ds.c.muted} />
            </PressableScale>
          </>
        ) : null}
        <PressableScale accessibilityLabel={`Remove ${item.name}`} onPress={() => onRemove(item.id)} style={styles.icon}>
          <IconSymbol name="xmark" size={16} color={ds.c.muted} />
        </PressableScale>
      </View>
    );
  };

  return (
    <View style={[styles.section, targeted && { backgroundColor: withAlpha(ds.accentText, 0.06), borderColor: withAlpha(ds.accentText, 0.4) }]}>
      <View style={styles.head}>
        <PressableScale
          accessibilityLabel={onTarget ? `${section.name}: add drinks here` : section.name}
          aria-selected={targeted}
          onPress={onTarget}
          disabled={!onTarget}
          style={styles.flex}
        >
          <DsText variant="title" numberOfLines={1}>
            {section.name}
          </DsText>
          <Caption tone={short > 0 || over > 0 ? 'accent' : 'muted'}>{note}</Caption>
        </PressableScale>
        <PressableScale accessibilityLabel={`${section.name} settings`} onPress={onSettings} style={styles.icon}>
          <IconSymbol name="ellipsis" size={18} color={ds.c.muted} />
        </PressableScale>
      </View>
      {count ? (
        <ListComponent
          data={section.drinks}
          keyExtractor={(d) => d.id}
          renderItem={renderItem}
          onDragEnd={({ data }) => onReorder(data)}
          scrollEnabled={false}
          activationDistance={10}
        />
      ) : null}
      <PressableScale accessibilityLabel={`Add a drink to ${section.name}`} onPress={onAdd} style={[styles.add, { borderColor: ds.c.lineStrong }]}>
        <IconSymbol name="plus" size={16} color={ds.c.ink} />
        <DsText variant="caption">{`Add to ${section.name}`}</DsText>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs, padding: space.sm, marginHorizontal: -space.sm, borderRadius: radius.card, borderWidth: 1, borderColor: 'transparent' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  grip: { width: 28, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 44 },
  flex: { flex: 1, gap: 2 },
  icon: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.3 },
  add: { marginTop: space.sm, minHeight: 48, borderRadius: radius.control, borderWidth: 1, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
});
