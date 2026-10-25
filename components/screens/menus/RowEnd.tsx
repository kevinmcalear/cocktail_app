import { Spec, useDs } from '@/components/ds';
import { STATUS } from '@/constants/palette';
import { readableAccent } from '@/lib/color';
import { menuRowShelf, needLine, type ShelfMatch } from '@/lib/collectionStages';
import { printedPrice } from '@/lib/menus';
import type { MenuDrink } from '@/types/menus';

/** What a page row's end says, for its label: "ready to make", "Need Cynar", or the price. */
export function rowEndLabel(drink: MenuDrink, shelf?: ShelfMatch | null): string | null {
  const end = shelf ? menuRowShelf(drink.id, shelf) : null;
  if (end) return end.ready ? 'ready to make' : needLine(end.need);
  return printedPrice(drink);
}

/**
 * A page row's end, in mono. On a home menu (`shelf`) it says what your shelf
 * makes: Ready in green, Need 1 or Need 2 in the accent (menus-one-look,
 * BandMenu). Otherwise, or when the shelf is further off, the price.
 */
export function RowEnd({ drink, shelf }: { drink: MenuDrink; shelf?: ShelfMatch | null }) {
  const ds = useDs();
  const end = shelf ? menuRowShelf(drink.id, shelf) : null;
  if (end) return <Spec color={end.ready ? readableAccent(STATUS.success, ds.c.ground) : ds.accentText}>{end.label}</Spec>;
  const price = printedPrice(drink);
  return price ? <Spec>{price}</Spec> : null;
}
