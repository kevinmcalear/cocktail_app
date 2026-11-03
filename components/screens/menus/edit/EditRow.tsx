import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { ScaleDecorator } from 'react-native-draggable-flatlist';

import { Caption, Headline, PressableScale, Tag, useDs } from '@/components/ds';
import { dragGripStyle } from '@/components/recipe/FormScrollContainer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, font, layout, radius, space } from '@/constants/tokens';
import { bothPrices, formatPrice, printedPrice } from '@/lib/menus';
import type { MenuDrink } from '@/types/menus';

import { MenuDrawing, type MenuInk } from '../page/MenuDrawing';
import { PriceEditor, type RowPricing } from '../RowPrice';
import { dragSource, dropRow, dropSlot } from '../useMenuDrag';

/** The handle's width: only a touch there starts a drag (gripOnly, on the left as drawn). */
export const HANDLE = 28;
/** The row's price box (Menu-page, edit: 64 wide). */
const PRICE_W = 64;

interface EditRowProps {
  drink: MenuDrink;
  index: number;
  count: number;
  ink: MenuInk;
  /** Made from this menu just now: a New tag after its name. */
  isNew?: boolean;
  active: boolean;
  drag: () => void;
  onRemove: () => void;
  onMove: (from: number, to: number) => void;
  /** A venue's row: its price box opens the drink's price and this menu's under it. A home menu has none. */
  pricing?: RowPricing;
  /** Another menu the drink is on. */
  alsoOn?: string;
  /** Desktop web drag and drop: the row's section, a drop slot above or below it, and whether it's the one held. */
  web?: { from: string; slot: 'before' | 'after' | null; dragging: boolean };
}

/** Where a dragged drink will land: a dashed slot the height of a row. */
export function DropSlot() {
  const ds = useDs();
  return (
    <View aria-hidden {...dropSlot} style={styles.slotSpace}>
      <View style={[styles.slot, { borderColor: ds.c.lineStrong }]} />
    </View>
  );
}

/**
 * A drink on the menu being edited in place (Menu-who-creator-edit): the
 * page's ruled row with a handle on the left, its drawing, name and line, the
 * price in a box, and a round minus that takes it off this menu. The handle
 * drags it; on the web its arrow keys move it too.
 */
export function EditRow({ drink, index: i, count, ink, isNew, active, drag, onRemove, onMove, pricing, alsoOn, web: dnd }: EditRowProps) {
  const ds = useDs();
  const web = Platform.OS === 'web';
  const [open, setPricing] = useState(false);
  const price = pricing ? printedPrice(drink) : null;
  const own = !!formatPrice(drink.menuPrice);
  const both = pricing ? bothPrices(drink) : null;
  const onKeyDown = (e: { key: string; preventDefault: () => void }) => {
    const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : null;
    if (to === null) return;
    e.preventDefault();
    if (to >= 0 && to < count) onMove(i, to);
  };
  return (
    <ScaleDecorator activeScale={1.02}>
      {dnd?.slot === 'before' ? <DropSlot /> : null}
      <View
        {...(dnd ? dragSource(drink.id, dnd.from) : {})}
        style={[styles.wrap, { borderTopColor: ds.c.lineStrong }, active && [styles.lifted, { backgroundColor: ds.c.raised }], dnd?.dragging && styles.held]}
      >
        <View {...(dnd ? dropRow : {})} style={styles.row}>
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
            style={[styles.handle, dragGripStyle]}
          >
            <IconSymbol name="line.3.horizontal" size={18} color={ds.c.muted} />
          </PressableScale>
          <MenuDrawing itemId={drink.id} size="row" ink={ink} fallback={{ imageUrl: drink.imageUrl, glass: drink.glass }} />
          <View style={styles.text}>
            <View style={styles.nameRow}>
              <Headline numberOfLines={2} style={[styles.name, { fontFamily: displayFaces[ds.displayFace].regular }]}>
                {drink.name}
              </Headline>
              {isNew ? <Tag label="New" tone="success" /> : null}
            </View>
            {drink.line ? (
              <Caption tone="muted" numberOfLines={2}>
                {drink.line}
              </Caption>
            ) : null}
            {both || (alsoOn && pricing) ? (
              <Caption tone="accent" numberOfLines={2}>
                {[both, alsoOn && pricing ? `also on ${alsoOn}` : null].filter(Boolean).join(' · ')}
              </Caption>
            ) : null}
          </View>
          {pricing ? (
            <PressableScale
              accessibilityLabel={price ? `${drink.name}: price ${price}${own ? ' on this menu' : ''}. Change it` : `Add a price for ${drink.name}`}
              aria-expanded={open}
              onPress={() => setPricing((p) => !p)}
              style={[styles.price, { borderColor: open ? ds.c.ink : ds.c.lineStrong, backgroundColor: ds.c.surface }]}
            >
              <Caption color={price ? (own ? ds.accentText : ds.c.ink) : ds.c.muted} style={font.figuresMedium} numberOfLines={1}>
                {price ?? '–'}
              </Caption>
            </PressableScale>
          ) : null}
          <PressableScale accessibilityLabel={`Take ${drink.name} off this menu`} onPress={onRemove} style={styles.minusHit}>
            <View style={[styles.minus, { borderColor: ds.c.lineStrong }]}>
              <IconSymbol name="minus" size={14} color={ds.c.muted} />
            </View>
          </PressableScale>
        </View>
        {open && pricing ? <PriceEditor drink={drink} alsoOn={alsoOn} pricing={pricing} onClose={() => setPricing(false)} /> : null}
      </View>
      {dnd?.slot === 'after' ? <DropSlot /> : null}
    </ScaleDecorator>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 4 },
  lifted: { borderRadius: radius.control, borderTopColor: 'transparent' },
  held: { opacity: 0.4 },
  handle: { width: HANDLE, height: layout.minTapTarget, marginRight: -space.xs, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  name: { flexShrink: 1 },
  price: { width: PRICE_W, height: 40, borderRadius: radius.control, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xs },
  // A 28 circle, as drawn, in a full tap target.
  minusHit: { width: 36, height: layout.minTapTarget, marginLeft: -space.xs, alignItems: 'center', justifyContent: 'center' },
  minus: { width: 28, height: 28, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  slotSpace: { paddingVertical: space.xs },
  slot: { height: 72, borderRadius: radius.control, borderWidth: 1, borderStyle: 'dashed' },
});
