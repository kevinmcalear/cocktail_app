import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Headline, PressableScale, Tag, useDs } from '@/components/ds';
import { DragGrip } from '@/components/ds/DragList';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, font, layout, radius, space } from '@/constants/tokens';
import { formatPrice, printedPrice } from '@/lib/menus';
import type { MenuDrink } from '@/types/menus';

import { MenuDrawing, type MenuInk } from '../page/MenuDrawing';
import { PriceEditor, type RowPricing } from '../RowPrice';
import { dragSource, dropRow, dropSlot } from '../useMenuDrag';

/** The row's price box (Menu-page, edit: 64 wide). */
const PRICE_W = 64;

interface EditRowProps {
  drink: MenuDrink;
  index: number;
  count: number;
  ink: MenuInk;
  /** Made from this menu just now: a New tag after its name. */
  isNew?: boolean;
  /** Being dragged (DragList). */
  lifted: boolean;
  /** Wraps the grip: DragList's, or none on the desktop, where the browser's drag and drop moves the row. */
  grip: (node: ReactNode) => ReactNode;
  onRemove: () => void;
  onMove: (from: number, to: number) => void;
  /** Tap the drink: its menu (Move to another section, Open the drink, Move to top, Delete drink). */
  onOpen: () => void;
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
 * price in a box (filled on a phone, white beside the library, as drawn; its drink and menu prices, and the other menus it's on,
 * open under the row), and a round minus that takes it off this menu. The handle
 * drags it; on the web its arrow keys move it too. Tapping the drink opens its
 * menu (RowMenuSheet).
 */
export function EditRow({ drink, index: i, count, ink, isNew, lifted, grip, onRemove, onMove, onOpen, pricing, alsoOn, web: dnd }: EditRowProps) {
  const ds = useDs();
  const [open, setPricing] = useState(false);
  const price = pricing ? printedPrice(drink) : null;
  const own = !!formatPrice(drink.menuPrice);
  const step = (by: -1 | 1) => {
    if (i + by >= 0 && i + by < count) onMove(i, i + by);
  };
  return (
    <>
      {dnd?.slot === 'before' ? <DropSlot /> : null}
      <View
        {...(dnd ? dragSource(drink.id, dnd.from) : {})}
        style={[styles.wrap, { borderTopColor: lifted ? 'transparent' : ds.c.lineStrong }, dnd?.dragging && styles.held]}
      >
        <View {...(dnd ? dropRow : {})} style={styles.row}>
          {grip(<DragGrip name={drink.name} onMove={step} lifted={lifted} />)}
          <PressableScale role="button" accessibilityLabel={`${drink.name}: move, open, delete`} aria-haspopup="menu" onPress={onOpen} style={styles.body}>
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
          </View>
          </PressableScale>
          {pricing ? (
            <PressableScale
              accessibilityLabel={price ? `${drink.name}: price ${price}${own ? ' on this menu' : ''}. Change it` : `Add a price for ${drink.name}`}
              aria-expanded={open}
              onPress={() => setPricing((p) => !p)}
              style={[styles.price, { borderColor: open ? ds.c.ink : ds.c.line, backgroundColor: dnd ? ds.c.surface : ds.c.raised }]}
            >
              <Caption color={price ? ds.c.ink : ds.c.muted} style={font.figuresMedium} numberOfLines={1}>
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
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 4 },
  held: { opacity: 0.4 },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minWidth: 0 },
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
