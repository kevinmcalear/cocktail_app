// Names the app uses for database rows. The rows are generated (types/db.ts,
// from types/database.ts); what's written here is what queries embed on top.
import type { ItemImageLink } from '@/lib/itemImages';
import type { Enum, Row } from '@/types/db';
import type { StoredPart } from '@/lib/drinkParts';

export type ItemDomain = Enum<'item_domain'>;
export type EntityType = Enum<'entity_type'>;

export type DatabaseCategory = Row<'categories'>;
export type DatabaseBar = Row<'bars'>;
export type DatabaseUserBar = Row<'user_bars'>;

export type DatabaseDraft = Omit<Row<'drafts'>, 'entity_type' | 'draft_data'> & {
    entity_type: EntityType | 'menu';
    // ponytail: each editor reads its own shape out of draft_data; typing them
    // (one form type per entity_type) would retire this any.
    draft_data: any;
    user?: { id: string; raw_user_meta_data?: any; email?: string } | null;
};

export type DatabaseItemCategory = Row<'item_categories'>;

export type DatabaseItemMethod = Row<'item_methods'> & {
    /** The method item, embedded. */
    method?: DatabaseItem;
};

export type DatabaseRecipe = Row<'recipes'> & {
    /** The ingredient item, embedded. */
    ingredient?: DatabaseItem;
};

/** The override levels: on items, but not in app_item_presentation, so only an items read has them. */
type OverrideLevels = Partial<
    Pick<
        Row<'items'>,
        | 'override_visibility_level'
        | 'override_generic_ingredient_level'
        | 'override_specific_brand_level'
        | 'override_measurement_level'
        | 'override_prep_level'
    >
>;

/** A drink, ingredient, glass, method or ice, as app_item_presentation shows it, with what the query embedded. */
export type DatabaseItem = Row<'app_item_presentation'> &
    OverrideLevels & {
        item_images?: ItemImageLink[];
        /** A cocktail's spec. */
        recipes?: DatabaseRecipe[];
        item_methods?: DatabaseItemMethod[];
        item_categories?: DatabaseItemCategory[];
        glassware?: DatabaseItem | null;
        family?: DatabaseItem | null;
        ice?: DatabaseItem | null;
        /** Made in parts: the parts' names and joins (lib/drinkParts.ts), read from items, not in app_item_presentation. */
        madeInParts?: StoredPart[] | null;
    };

/** A spec line as app_recipe_presentation shows it: amounts and ingredients the reader may not see are null. */
export type AppRecipePresentation = Row<'app_recipe_presentation'> & {
    /** The item behind display_ingredient_id (a computed relationship). */
    display_ingredient?: DatabaseItem | null;
    ingredient?: DatabaseItem;
};
