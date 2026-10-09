export type ItemDomain = 'beer' | 'wine' | 'spirit' | 'ingredient' | 'cocktail_family' | 'glassware_style';
export type EntityType = 'cocktail' | 'ingredient' | 'beer' | 'wine' | 'glassware' | 'method' | 'ice' | 'family';
export type AttributeType = 'tasting_note' | 'physical_trait';

export interface DatabaseCategory {
    id: string;
    name: string;
    parent_id: string | null;
    domain: ItemDomain | null;
    description: string | null;
    created_at: string;
}

export interface DatabaseBar {
    id: string;
    name: string;
    /** URL-safe name for the staff link, /v/<slug>. Kept when the bar is renamed. */
    slug: string;
    default_visibility_level: number;
    default_generic_ingredient_level: number;
    default_specific_brand_level: number;
    default_measurement_level: number;
    default_prep_level: number;
    logo_url?: string | null;
    primary_color?: string | null;
    secondary_color?: string | null;
    created_at: string;
}

export interface DatabaseUserBar {
    id: string;
    user_id: string;
    bar_id: string;
    role_level: number;
    created_at: string;
}

export interface DatabaseAttribute {
    id: string;
    name: string;
    type: AttributeType;
}

export interface DatabaseDraft {
    id: string;
    user_id: string;
    entity_type: EntityType | 'menu';
    draft_data: any;
    bar_id?: string | null;
    created_at: string;
    updated_at: string;
    user?: { id: string; raw_user_meta_data?: any; email?: string } | null;
}

export interface DatabaseImage {
    id: string;
    url: string;
    created_at: string;
    /** Drink field colours [dominant, deep, light] as "#rrggbb"; [] = no colour, null = not computed yet. */
    palette?: string[] | null;
}

export interface DatabaseItemImage {
    id: string;
    item_id: string;
    image_id: string;
    sort_order: number | null;
    images?: DatabaseImage;
}

export interface DatabaseItemCategory {
    item_id: string;
    category_id: string;
    is_primary: boolean | null;
    categorie?: DatabaseCategory; // Supabase usually infers singular/plural, standard is singular. Let's use `categories?` or just `category?`. Often with supabase it uses the table name, so `categories?: DatabaseCategory;`
}

export interface DatabaseItemMethod {
    item_id: string;
    method_item_id: string;
    sort_order: number | null;
    method?: DatabaseItem; // Self-referential join to the method item
}

export interface DatabaseRecipe {
    id: string;
    created_at: string;
    recipe_item_id: string;
    ingredient_item_id: string;
    amount: number | null;
    unit: string | null;
    preparation_notes: string | null;
    is_optional: boolean | null;
    parent_ingredient_id: string | null;
    sort_order: number | null;
    /** Added at the station (true) or in the batch (false); null until decided. */
    at_service?: boolean | null;
    ingredient?: DatabaseItem; // The actual ingredient item
}

export interface DatabaseItem {
    id: string;
    name: string;
    /** Ingredients: what this is a kind of ("Tanqueray" is a kind of "Gin"). */
    generic_id?: string | null;
    item_type: EntityType;
    description: string | null;
    created_at: string;
    
    // Type-Specific Nullable Fields
    glassware_id: string | null;
    family_id: string | null;
    ice_id: string | null;
    notes: string | null;
    origin: string | null;
    /** ISO 3166-1 alpha-2 country it comes from ("GB"); origin keeps the free text. */
    origin_country?: string | null;
    /** The protected name it carries, as labelled ("Cognac"), when it has one. */
    gi?: string | null;
    price: string | null;
    status: string | null;
    brand_maker: string | null;
    abv: number | null;
    bar_id: string | null;
    icon_key?: string | null;
    icon_url?: string | null;
    hide_from_search?: boolean;
    /** How it's served: a_la_minute, batched, bottled, carbonated or draught. */
    service_style?: string | null;
    /** Ingredients: grams per ml, when measured. */
    density_g_ml?: number | null;
    /** Drinks: a measured dilution, in percent, overriding the method's default. */
    dilution_pct?: number | null;
    /** Calculated on the server from the spec: the serve after dilution and its ABV. */
    serve_ml?: number | null;
    serve_abv?: number | null;
    /** 'calculated' when the spec sets abv; 'manual' keeps a typed figure. */
    abv_source?: 'manual' | 'calculated';
    /** Glassware: to the brim, and what the liquid fills once the ice is in. */
    capacity_ml?: number | null;
    iced_capacity_ml?: number | null;
    /** Cocktails: ice in the glass per serve. */
    ice_per_serve_g?: number | null;
    /** The menu price in minor units of the bar's currency. */
    price_minor?: number | null;

    // Progressive Disclosure Overrides
    override_visibility_level: number | null;
    override_generic_ingredient_level: number | null;
    override_specific_brand_level: number | null;
    override_measurement_level: number | null;
    override_prep_level: number | null;

    // Joined Data
    item_images?: DatabaseItemImage[];
    recipes?: DatabaseRecipe[]; // If it's a cocktail, what are its recipes
    item_methods?: DatabaseItemMethod[];
    item_categories?: DatabaseItemCategory[];
    glassware?: DatabaseItem | null; // Self-referential join
    family?: DatabaseItem | null; // Self-referential join
    ice?: DatabaseItem | null; // Self-referential join
}

export interface AppItemPresentation extends DatabaseItem {
    // This view mirrors DatabaseItem exactly, but masks rows based on user role
}

export interface AppRecipePresentation {
    id: string;
    created_at: string;
    recipe_item_id: string;
    display_ingredient_id: string | null; // The dynamically selected ingredient ID
    amount: number | null; // Redacted to null if insufficient role
    unit: string | null; // Redacted to null if insufficient role
    preparation_notes: string | null; // Redacted to null if insufficient role
    is_optional: boolean | null;
    parent_ingredient_id: string | null; // Redacted to null if insufficient role
    ingredient_item_id: string | null; // The specific ingredient; redacted to null if insufficient role
    at_service?: boolean | null; // Redacted to null with the amounts
    display_ingredient?: DatabaseItem | null; // Computed relationship: the item behind display_ingredient_id
    ingredient?: DatabaseItem; // The joined Display Ingredient
}
