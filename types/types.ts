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
    default_visibility_level: number;
    default_generic_ingredient_level: number;
    default_specific_brand_level: number;
    default_measurement_level: number;
    default_prep_level: number;
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

export interface DatabaseImage {
    id: string;
    url: string;
    created_at: string;
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
    ingredient?: DatabaseItem; // The actual ingredient item
}

export interface DatabaseItem {
    id: string;
    name: string;
    item_type: EntityType;
    description: string | null;
    created_at: string;
    
    // Type-Specific Nullable Fields
    glassware_id: string | null;
    family_id: string | null;
    ice_id: string | null;
    notes: string | null;
    origin: string | null;
    price: string | null;
    status: string | null;
    brand_maker: string | null;
    abv: number | null;
    bar_id: string | null;

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
    parent_ingredient_id: string | null;
    ingredient_item_id: string; // The original specific ingredient
    ingredient?: DatabaseItem; // The joined Display Ingredient
}
