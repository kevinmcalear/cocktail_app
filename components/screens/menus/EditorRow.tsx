import { useRouter } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { ScaleDecorator } from 'react-native-draggable-flatlist';

import { Caption, DrinkImage, DsText, PressableScale, Spec, useBreakpoint, useDs } from '@/components/ds';
import { dragGripStyle } from '@/components/recipe/FormScrollContainer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, layout, radius, space, type } from '@/constants/tokens';
import { itemHref, type ItemCategory } from '@/lib/itemRoutes';
import { formatPrice } from '@/lib/menus';
import type { MenuDrink } from '@/types/menus';

import { RowMenu, useRowMenu, type RowMenuItem } from './RowMenu';

/** The grip's width: only a touch there starts a drag (gripOnly). */
export const GRIP = 28;
/** A row's picture, a little taller than wide, like the menu's own tiles (64 by 72). */
const TILE = 8 / 9;

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
}

const CATEGORY: Record<MenuDrink['kind'], ItemCategory> = { cocktail: 'Cocktail', beer: 'Beer', wine: 'Wine' };

/**
 * One drink on the menu being edited, set like the menu itself: its picture on
 * paper, its name in the venue's display face, its line, for a venue its price
 * in mono, then the grip on the right (b36). A ... button holds Move to
 * another section, Open the drink, Move to top (and on a phone, Remove). On a
 * desktop browser, Remove and ... show on hover or keyboard focus.
 */
export function EditorRow({ drink, index: i, count, home, active, drag, onRemove, onMove, others, onMoveTo }: EditorRowProps) {
  const ds = useDs();
  const router = useRouter();
  const [menu, setMenu] = useState<'open' | 'sections'>('open');
  const popover = useRowMenu();
  const more = useRef<ComponentRef<typeof View>>(null);
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
  const show = !quiet || hot || active || !!popover.anchor;
  const pick = (fn: () => void) => () => {
    popover.close();
    fn();
  };
  const items: RowMenuItem[] =
    menu === 'sections'
      ? [{ label: 'Back', icon: 'chevron.left', onPress: () => setMenu('open') }, ...others.map((o) => ({ label: o.name, icon: 'arrow.turn.down.right' as const, onPress: pick(() => onMoveTo(o.key)) }))]
      : [
          ...(others.length ? [{ label: 'Move to another section', icon: 'arrow.turn.down.right' as const, more: true, onPress: () => setMenu('sections') }] : []),
          { label: 'Open the drink', icon: 'arrow.up.right.square', onPress: pick(() => router.push(itemHref(CATEGORY[drink.kind], drink.id) as never)) },
          ...(i > 0 ? [{ label: 'Move to top', icon: 'arrow.up.to.line' as const, onPress: pick(() => onMove(i, 0)) }] : []),
          ...(quiet ? [] : [{ label: 'Remove', icon: 'xmark' as const, onPress: pick(onRemove) }]),
        ];
  // Wide: the menu's own size (b-desktop 26 on 30); a phone, a step down (22 on 26).
  const nameSize = quiet ? styles.nameWide : styles.namePhone;
  return (
    <ScaleDecorator activeScale={1.02}>
      <View {...hover} style={[styles.wrap, { borderBottomColor: ds.c.line }, (active || (quiet && hot)) && [styles.lifted, { backgroundColor: ds.c.raised }]]}>
        <View style={styles.row}>
          <View style={quiet ? styles.thumbWide : styles.thumb}>
            <DrinkImage thumb sketchDetail="thumb" aspectRatio={TILE} source={drink.imageUrl} generated={drink.isSketch} glass={drink.glass} itemId={drink.id} accessibilityLabel={drink.name} radius="control" />
          </View>
          <View style={styles.text}>
            <DsText variant="headline" numberOfLines={2} style={[nameSize, { fontFamily: displayFaces[ds.displayFace].regular }]}>
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
          <View ref={more} collapsable={false}>
            <PressableScale
              accessibilityLabel={`${drink.name} options`}
              aria-haspopup="menu"
              aria-expanded={!!popover.anchor}
              onPress={() => {
                setMenu('open');
                popover.open(more.current);
              }}
              style={[styles.icon, !show && styles.hidden, popover.anchor ? { backgroundColor: ds.c.lineStrong } : null]}
            >
              <IconSymbol name="ellipsis" size={16} color={popover.anchor ? ds.c.ink : ds.c.muted} />
            </PressableScale>
          </View>
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
            <IconSymbol name="circle.grid.3x3.fill" size={18} color={ds.c.muted} />
          </PressableScale>
        </View>
        <RowMenu anchor={popover.anchor} label={menu === 'sections' ? `Move ${drink.name} to` : `${drink.name} options`} items={items} onClose={popover.close} />
      </View>
    </ScaleDecorator>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  // No right padding: the grip is the row's last GRIP points (gripOnly 'right').
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  // Hovered or picked up: a raised tile, so no divider under it.
  lifted: { borderRadius: radius.control, borderBottomColor: 'transparent' },
  grip: { width: GRIP, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 52 },
  thumbWide: { width: 64 },
  nameWide: { fontSize: type.headline.fontSize * 1.3, lineHeight: 30 },
  namePhone: { fontSize: type.headline.fontSize * 1.1, lineHeight: 26 },
  text: { flex: 1, gap: 2, minWidth: 0 },
  icon: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  // Still focusable, so keyboard focus brings it back.
  hidden: { opacity: 0 },
});
