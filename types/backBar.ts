// The back bar tables (supabase/migrations/20260926150200_back_bar.sql and
// 20261101100000_back_bar_stock.sql), as the app selects them.
import type { Enum, Row } from '@/types/db';

export type BarZoneKind = Enum<'bar_zone_kind'>;

/**
 * A place behind the bar, drawn on the venue's plan as fractions of its width and height.
 * description: "Under the back bar, second from the left. 4 °C." The four plan_* are null
 * until the zone is drawn, and keep it inside the plan.
 */
export type BarZone = Pick<
  Row<'bar_zones'>,
  'id' | 'bar_id' | 'name' | 'kind' | 'description' | 'photo_url' | 'plan_x' | 'plan_y' | 'plan_w' | 'plan_h' | 'sort_order'
>;

/**
 * One place an item lives at a venue. An item can live in several.
 * shelf: "Top shelf · left". container: "1 L squeeze bottle, blue tape, date on the cap".
 */
export type ItemLocation = Pick<
  Row<'item_locations'>,
  'id' | 'bar_id' | 'item_id' | 'zone_id' | 'shelf' | 'container' | 'photo_url' | 'par_amount' | 'par_unit' | 'sort_order'
> & {
  /** Embedded; null when the item isn't visible to the reader. */
  item: { id: string; name: string } | null;
};

/**
 * Where a bottle on the stock list came from: a drink's line, venue setup, or the back bar page.
 * back_bar_items.source is text with a CHECK, so the generator types it as string.
 */
export type BackBarSource = 'drink' | 'setup' | 'back_bar';

/**
 * One bottle a venue says it stocks, with or without a spot.
 * from_name: the drink it was added from, as it was named then.
 */
export type BackBarItem = Pick<Row<'back_bar_items'>, 'id' | 'bar_id' | 'item_id' | 'from_name' | 'added_at'> & {
  source: BackBarSource;
  /** Embedded; null when the item isn't visible to the reader. */
  item: { id: string; name: string } | null;
};
