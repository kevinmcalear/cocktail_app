// The back bar tables (supabase/migrations/20260926150200_back_bar.sql and 20261101100000_back_bar_stock.sql).

export type BarZoneKind =
  | 'shelf'
  | 'fridge'
  | 'freezer'
  | 'speed_rail'
  | 'well'
  | 'garnish'
  | 'glass_rack'
  | 'sink'
  | 'bar_top'
  | 'storeroom'
  | 'other';

/** A place behind the bar, drawn on the venue's plan as fractions of its width and height. */
export interface BarZone {
  id: string;
  bar_id: string;
  name: string;
  kind: BarZoneKind;
  /** "Under the back bar, second from the left. 4 °C." */
  description: string | null;
  photo_url: string | null;
  /** All four are null until the zone is drawn, and keep it inside the plan. */
  plan_x: number | null;
  plan_y: number | null;
  plan_w: number | null;
  plan_h: number | null;
  sort_order: number;
}

/** One place an item lives at a venue. An item can live in several. */
export interface ItemLocation {
  id: string;
  bar_id: string;
  item_id: string;
  zone_id: string;
  /** "Top shelf · left" */
  shelf: string | null;
  /** "1 L squeeze bottle, blue tape, date on the cap" */
  container: string | null;
  photo_url: string | null;
  par_amount: number | null;
  par_unit: string | null;
  sort_order: number;
  /** Embedded; null when the item isn't visible to the reader. */
  item: { id: string; name: string } | null;
}

/** Where a bottle on the stock list came from: a drink's line, venue setup, or the back bar page. */
export type BackBarSource = 'drink' | 'setup' | 'back_bar';

/** One bottle a venue says it stocks (20261101100000_back_bar_stock.sql), with or without a spot. */
export interface BackBarItem {
  id: string;
  bar_id: string;
  item_id: string;
  source: BackBarSource;
  /** The drink it was added from, as it was named then. */
  from_name: string | null;
  added_at: string;
  /** Embedded; null when the item isn't visible to the reader. */
  item: { id: string; name: string } | null;
}
