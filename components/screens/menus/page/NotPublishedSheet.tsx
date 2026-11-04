import { StyleSheet, View } from 'react-native';

import { Body, Caption, Spec } from '@/components/ds';
import { space } from '@/constants/tokens';
import { printedPrice } from '@/lib/menus';
import type { MenuDrink } from '@/types/menus';

import { MenuSheet } from '../MenuSheet';
import { MenuDrawing } from './MenuDrawing';

/**
 * A guest taps a drink the bar hasn't published (Kevin, 3 Nov): a small card
 * from what the menu already shows a guest, its name, line and price, and why
 * there's no page yet. Nothing more is read, so no new access is needed.
 */
export function NotPublishedSheet({ drink, barName, onClose }: { drink: MenuDrink; barName: string; onClose: () => void }) {
  const price = printedPrice(drink);
  return (
    <MenuSheet visible onClose={onClose} eyebrow={barName} title={drink.name}>
      <View style={styles.body}>
        <MenuDrawing itemId={drink.id} size="row" ink="colour" fallback={{ imageUrl: drink.imageUrl, glass: drink.glass }} />
        <View style={styles.text}>
          {drink.line ? <Body>{drink.line}</Body> : null}
          {price ? <Spec>{price}</Spec> : null}
        </View>
      </View>
      <Caption tone="muted">{`${barName} hasn’t published this drink yet, so it has no page. Ask at the bar about it.`}</Caption>
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  body: { flexDirection: 'row', gap: space.md, alignItems: 'center', paddingBottom: space.md },
  text: { flex: 1, gap: space.xs },
});
