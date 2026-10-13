import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { ScaleDecorator } from 'react-native-draggable-flatlist';

import { Button, Caption, DrinkImage, DsText, PressableScale, Spec, useBreakpoint, useDs } from '@/components/ds';
import { dragGripStyle } from '@/components/recipe/FormScrollContainer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, layout, radius, space } from '@/constants/tokens';
import { itemHref, type ItemCategory } from '@/lib/itemRoutes';
import { formatPrice } from '@/lib/menus';
import type { MenuDrink } from '@/types/menus';

import { dragSource, dropRow, dropSlot } from './useMenuDrag';

/** The grip's width: only a touch there starts a drag (gripOnly). */
export const GRIP = 28;

interface EditorRowProps {
  drink: MenuDrink;
  index: number;
  count: number;
  /** A home menu: no prices. */
  home?: boolean;
  active: boolean;
  drag: () => void;
  onRemove: () => void;
  onMove: (from: number, to: number) => void;
  /** The other sections, for "Move to another section". */
  others: { key: string; name: string }[];
  onMoveTo: (toKey: string) => void;
  /** Desktop web drag and drop: the row's section, a drop slot above or below it, and whether it's the one being dragged. */
  web?: { from: string; slot: 'before' | 'after' | null; dragging: boolean };
}

/** Where a dragged drink will land, as the board draws it: a dashed slot the height of a row. */
export function DropSlot() {
  const ds = useDs();
  return (
    <View aria-hidden {...dropSlot} style={styles.slotSpace}>
      <View style={[styles.slot, { borderColor: ds.c.lineStrong }]} />
    </View>
  );
}

const CATEGORY: Record<MenuDrink['kind'], ItemCategory> = { cocktail: 'Cocktail', beer: 'Beer', wine: 'Wine' };

/**
 * One drink on the menu being edited, set like the menu itself: its picture on
 * paper, its name in the venue's display face, its line, for a venue its price
 * in mono, then the grip on the right (b36). A ... button holds Move to
 * another section, Open the drink, Move to top (and on a phone, Remove). On a
 * desktop browser, Remove and ... show on hover or keyboard focus.
 */
export function EditorRow({ drink, index: i, count, home, active, drag, onRemove, onMove, others, onMoveTo, web: dnd }: EditorRowProps) {
  const ds = useDs();
  const router = useRouter();
  const [menu, setMenu] = useState<'closed' | 'open' | 'sections'>('closed');
  const web = Platform.OS === 'web';
  const breakpoint = useBreakpoint();
  // A desktop browser: Remove waits for the pointer or keyboard focus.
  const quiet = web && breakpoint === 'desktop';
  const [hot, setHot] = useState(false);
  // react-native-web passes these to the row's div; focus events bubble from the grip and Remove.
  const hover = quiet ? ({ onMouseEnter: () => setHot(true), onMouseLeave: () => setHot(false), onFocus: () => setHot(true), onBlur: () => setHot(false) } as object) : {};
  const price = home ? null : formatPrice(drink.price);
  // Keyboard (web): the focused grip moves its drink with the arrow keys.
  const onKeyDown = (e: { key: string; preventDefault: () => void }) => {
    const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : null;
    if (to === null) return;
    e.preventDefault();
    if (to >= 0 && to < count) onMove(i, to);
  };
  const show = !quiet || hot || active || menu !== 'closed';
  const pick = (fn: () => void) => () => {
    setMenu('closed');
    fn();
  };
  return (
    <ScaleDecorator activeScale={1.02}>
      {dnd?.slot === 'before' ? <DropSlot /> : null}
      <View
        {...hover}
        {...(dnd ? dragSource(drink.id, dnd.from) : {})}
        style={[styles.wrap, { borderBottomColor: ds.c.line }, (active || (quiet && hot)) && [styles.lifted, { backgroundColor: ds.c.raised }], dnd?.dragging && styles.held]}
      >
        <View {...(dnd ? dropRow : {})} style={styles.row}>
          <View style={styles.thumb}>
            <DrinkImage thumb sketchDetail="thumb" source={drink.imageUrl} generated={drink.isSketch} glass={drink.glass} itemId={drink.id} accessibilityLabel={drink.name} radius="control" />
          </View>
          <View style={styles.text}>
            <DsText variant="headline" numberOfLines={2} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
              {drink.name}
            </DsText>
            {drink.line ? (
              <Caption tone="muted" numberOfLines={1}>
                {drink.line}
              </Caption>
            ) : null}
          </View>
          {home ? null : price ? <Spec>{price}</Spec> : <Caption tone="muted">No price</Caption>}
          {quiet ? (
            <PressableScale accessibilityLabel={`Remove ${drink.name}`} onPress={onRemove} style={[styles.icon, !show && styles.hidden]}>
              <IconSymbol name="xmark" size={16} color={ds.c.muted} />
            </PressableScale>
          ) : null}
          <PressableScale
            accessibilityLabel={`${drink.name} options`}
            aria-expanded={menu !== 'closed'}
            onPress={() => setMenu(menu === 'closed' ? 'open' : 'closed')}
            style={[styles.icon, !show && styles.hidden]}
          >
            <IconSymbol name="ellipsis" size={16} color={ds.c.muted} />
          </PressableScale>
          <PressableScale
            accessibilityLabel={`Reorder ${drink.name}`}
            accessibilityHint={web ? 'Drag, or press the up and down arrow keys, to move it' : 'Drag, or use the actions to move it up or down'}
            accessibilityActions={[{ name: 'moveUp', label: 'Move up' }, { name: 'moveDown', label: 'Move down' }]}
            onAccessibilityAction={(e) => onMove(i, e.nativeEvent.actionName === 'moveUp' ? i - 1 : i + 1)}
            onLongPress={web ? undefined : drag}
            onPressIn={web ? drag : undefined}
            // @ts-expect-error onKeyDown is web-only (react-native-web)
            onKeyDown={onKeyDown}
            disabled={active}
            style={[styles.grip, dragGripStyle]}
          >
            <IconSymbol name="line.3.horizontal" size={18} color={ds.c.muted} />
          </PressableScale>
        </View>
        {menu === 'open' ? (
          <View role="menu" accessibilityLabel={`${drink.name} options`} style={styles.menu}>
            {others.length ? <Button label="Move to another section" icon="arrow.turn.down.right" variant="secondary" onPress={() => setMenu('sections')} /> : null}
            <Button label="Open the drink" icon="arrow.up.right.square" variant="secondary" onPress={pick(() => router.push(itemHref(CATEGORY[drink.kind], drink.id) as never))} />
            {i > 0 ? <Button label="Move to top" icon="arrow.up.to.line" variant="secondary" onPress={pick(() => onMove(i, 0))} /> : null}
            {quiet ? null : <Button label="Remove" icon="xmark" variant="ghost" onPress={pick(onRemove)} />}
          </View>
        ) : menu === 'sections' ? (
          <View role="menu" accessibilityLabel={`Move ${drink.name} to`} style={styles.menu}>
            {others.map((o) => (
              <Button key={o.key} label={o.name} variant="secondary" onPress={pick(() => onMoveTo(o.key))} />
            ))}
            <Button label="Cancel" variant="ghost" onPress={() => setMenu('closed')} />
          </View>
        ) : null}
      </View>
      {dnd?.slot === 'after' ? <DropSlot /> : null}
    </ScaleDecorator>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  // No right padding: the grip is the row's last GRIP points (gripOnly 'right').
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  menu: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingBottom: space.md, paddingLeft: 56 + space.md },
  // Hovered or picked up: a raised tile, so no divider under it.
  lifted: { borderRadius: radius.control, borderBottomColor: 'transparent' },
  grip: { width: GRIP, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 56 },
  text: { flex: 1, gap: 2, minWidth: 0 },
  icon: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  // Still focusable, so keyboard focus brings it back.
  hidden: { opacity: 0 },
  // Being dragged: it stays in place, faint, until it lands.
  held: { opacity: 0.4 },
  // Its whole height is what it pushes the rows down by (useMenuDrag), so no margins.
  slotSpace: { paddingVertical: space.xs },
  slot: { height: 72, borderRadius: radius.control, borderWidth: 1, borderStyle: 'dashed' },
});
