import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { ScaleDecorator } from 'react-native-draggable-flatlist';

import { Caption, DrinkImage, DsText, PressableScale, Spec, useBreakpoint, useDs } from '@/components/ds';
import { dragGripStyle } from '@/components/recipe/FormScrollContainer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, layout, radius, space } from '@/constants/tokens';
import { formatPrice } from '@/lib/menus';
import type { MenuDrink } from '@/types/menus';

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
}

/**
 * One drink on the menu being edited, set like the menu itself: its picture on
 * paper, its name in the venue's display face, its line, and for a venue its
 * price. On a desktop browser, Remove shows on hover or keyboard focus.
 */
export function EditorRow({ drink, index: i, count, home, active, drag, onRemove, onMove }: EditorRowProps) {
  const ds = useDs();
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
  const show = !quiet || hot || active;
  return (
    <ScaleDecorator activeScale={1.02}>
      <View
        {...hover}
        style={[styles.row, { borderBottomColor: ds.c.line }, (active || (quiet && hot)) && [styles.lifted, { backgroundColor: ds.c.raised }]]}
      >
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
        <PressableScale accessibilityLabel={`Remove ${drink.name}`} onPress={onRemove} style={[styles.icon, !show && styles.hidden]}>
          <IconSymbol name="xmark" size={16} color={ds.c.muted} />
        </PressableScale>
      </View>
    </ScaleDecorator>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, paddingRight: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  // Hovered or picked up: a raised tile, so no divider under it.
  lifted: { borderRadius: radius.control, borderBottomColor: 'transparent' },
  grip: { width: GRIP, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 56 },
  text: { flex: 1, gap: 2, minWidth: 0 },
  icon: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  // Still focusable, so keyboard focus brings it back.
  hidden: { opacity: 0 },
});
