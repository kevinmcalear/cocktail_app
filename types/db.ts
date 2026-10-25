// The database's types: the generated schema (types/database.ts, rebuilt with
// `npm run gen:types`) with two corrections for what the generator can't see:
// - Postgres reports every view column as nullable, so the columns a view
//   passes straight through from a table take that table's types here
//   (items.id is never null, nor is it in the view).
// - The generator types every function argument as never null. The ones the
//   app sends null for on purpose are listed in NullArgs below; each is
//   DEFAULT NULL in SQL or read as "none" by the function. Every other
//   argument stays non-null, so null can't stand in for a required argument
//   or override a non-null default (a null p_limit would mean no limit).
import type { Database as Generated } from '@/types/database';

export type { Json } from '@/types/database';

type Public = Generated['public'];
type TableRow<T extends keyof Public['Tables']> = Public['Tables'][T]['Row'];
type Views = Public['Views'];

/** View `V` with columns `K` typed as in `Row`. */
type PassThrough<V extends keyof Views, Row, K extends keyof Views[V]['Row'] & keyof Row> = Omit<Views[V], 'Row'> & {
  Row: { [P in keyof Views[V]['Row']]: P extends K ? Row[P] : Views[V]['Row'][P] };
};

// app_item_presentation selects every column from items c (COALESCE keeps a
// nullable column nullable), so it reads like an items row.
type ItemView = PassThrough<'app_item_presentation', TableRow<'items'>, keyof Views['app_item_presentation']['Row'] & keyof TableRow<'items'>>;
// app_recipe_presentation masks the amounts and ingredients (those stay
// nullable) and passes these through from recipes r.
type RecipeView = PassThrough<'app_recipe_presentation', TableRow<'recipes'>, 'id' | 'created_at' | 'recipe_item_id' | 'is_optional' | 'sort_order'>;

type Fns = Public['Functions'];

/** The arguments that take null, per function (checked against the SQL, 22 Oct). */
type NullArgs = {
  add_venue: 'p_postcode' | 'p_region' | 'p_locality';
  approve_profile_claim: 'p_code';
  discover_list: 'p_bar_id' | 'p_query' | 'p_styles' | 'p_spirits' | 'p_notes';
  resolve_report: 'p_resolution';
  // No cover is null; a null position falls back to 50.
  save_menu: 'p_cover_url' | 'p_cover_position';
  save_drink_spec: 'p_note';
  // A fact the sheet doesn't say is null (no p_id adds a new ice).
  save_venue_ice: 'p_id' | 'p_draw_as' | 'p_size_mm' | 'p_length_mm' | 'p_clear' | 'p_frozen_inside' | 'p_source' | 'p_supplier_id' | 'p_machine' | 'p_note';
  schedule_menu: 'p_starts_at';
  search_glass_models: 'p_glass';
  // Null clears the match.
  set_spec_match: 'p_spec_match';
  // A venue role (p_role_id) or a built-in level (p_level); the other is null.
  set_role_capability: 'p_role_id' | 'p_level';
  start_bar_claim: 'p_bar_id' | 'p_note' | 'p_code' | 'p_instagram' | 'p_website' | 'p_phone';
  start_person_claim: 'p_note' | 'p_code';
  update_bar_settings: 'p_logo_url' | 'p_primary_color' | 'p_secondary_color';
};

/** Function `F` (each overload) with arguments `K` also taking null. */
type WithNullArgs<F, K extends PropertyKey> = F extends { Args: infer A }
  ? Omit<F, 'Args'> & { Args: { [P in keyof A]: P extends K ? A[P] | null : A[P] } }
  : F;
type Functions = { [N in keyof Fns]: N extends keyof NullArgs ? WithNullArgs<Fns[N], NullArgs[N]> : Fns[N] };

export type Database = Omit<Generated, 'public'> & {
  public: Omit<Public, 'Views' | 'Functions'> & {
    Functions: Functions;
    Views: Omit<Views, 'app_item_presentation' | 'app_recipe_presentation'> & {
      app_item_presentation: ItemView;
      app_recipe_presentation: RecipeView;
    };
  };
};

type Schema = Database['public'];

/** A row of a table or view, as selected with `*`. */
export type Row<T extends keyof Schema['Tables'] | keyof Schema['Views']> = T extends keyof Schema['Tables']
  ? Schema['Tables'][T]['Row']
  : T extends keyof Schema['Views']
    ? Schema['Views'][T]['Row']
    : never;
export type Insert<T extends keyof Schema['Tables']> = Schema['Tables'][T]['Insert'];
export type Update<T extends keyof Schema['Tables']> = Schema['Tables'][T]['Update'];
export type Enum<T extends keyof Schema['Enums']> = Schema['Enums'][T];
