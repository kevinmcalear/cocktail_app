import type { SortableRecipeItem } from "@/components/recipe/SortableRecipeList";

type DropdownItem = { id: string; name: string; icon_key?: string | null; icon_url?: string | null };

export function buildDraftCocktailView(
    state: {
        name: string;
        description: string;
        origin: string;
        notes: string;
        methodId: string | null;
        glasswareId: string | null;
        familyId: string | null;
        iceId: string | null;
        methods: DropdownItem[];
        glassware: DropdownItem[];
        families: DropdownItem[];
        iceTypes: DropdownItem[];
        recipeItems: SortableRecipeItem[];
    },
    draftId?: string | null
) {
    const label = (list: DropdownItem[], id: string | null) =>
        id ? list.find((item) => item.id === id)?.name ?? null : null;

    return {
        id: draftId || "new-draft",
        name: state.name || "Untitled Cocktail",
        description: state.description || null,
        origin: state.origin || null,
        notes: state.notes || null,
        item_methods: state.methodId
            ? [{ method: { name: label(state.methods, state.methodId) } }]
            : [],
        glassware: state.glasswareId ? { name: label(state.glassware, state.glasswareId) } : null,
        family: state.familyId ? { name: label(state.families, state.familyId) } : null,
        ice: state.iceId ? { name: label(state.iceTypes, state.iceId) } : null,
        recipes: state.recipeItems.map((item) => ({
            ingredient_id: item.ingredient_id,
            amount: item.amount,
            unit: item.unit,
            ingredient: { id: item.ingredient_id, name: item.name },
        })),
        item_images: [],
    };
}
