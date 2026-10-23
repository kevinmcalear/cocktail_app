// The database's types: the generated schema (types/database.ts, rebuilt with
// `npm run gen:types`) with two corrections for what the generator can't see:
// - Postgres reports every view column as nullable, so the columns a view
//   passes straight through from a table take that table's types here
//   (items.id is never null, nor is it in the view).
// - Any function argument can be null in Postgres (the app sends null for
//   "not set"), but the generator types each one as never null.
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

type NullArgs<F> = F extends { Args: infer A }
  ? [A] extends [never]
    ? F
    : Omit<F, 'Args'> & { Args: { [P in keyof A]: A[P] | null } }
  : F;
type Functions = { [K in keyof Public['Functions']]: NullArgs<Public['Functions'][K]> };

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
