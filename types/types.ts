export interface DatabaseIngredient {
    id: string;
    name: string;
}

export interface DatabaseRecipe {
    id: string;
    ingredient_ml: number | null;
    ingredient_dash: number | null;
    ingredient_amount: number | null;
    ingredients: DatabaseIngredient | null;
}

export interface DatabaseMethod {
    id: string;
    name: string;
}

export interface DatabaseGlassware {
    id: string;
    name: string;
}

export interface DatabaseFamily {
    id: string;
    name: string;
}

export interface DatabaseCocktail {
    id: string;
    created_at: string;
    name: string;
    description: string;
    cocktail_images?: {
        images: {
            id: string;
            url: string;
        }
    }[];
    method_id: string | null;
    glassware_id: string | null;
    family_id: string | null;
    notes: string | null;
    origin: string | null;
    garnish_1: string | null;
    spec: string | null;
    recipes?: DatabaseRecipe[];
    methods?: DatabaseMethod | null;
    glassware?: DatabaseGlassware | null;
    families?: DatabaseFamily | null;
}
