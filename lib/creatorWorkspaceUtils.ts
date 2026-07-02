import { SelectedDraftNode } from '@/components/DraftFolderTree';

export interface EditingState {
    mode: 'create' | 'edit';
    type: 'cocktail' | 'beer' | 'wine' | 'ingredient' | 'menu';
    draftId?: string;
    barId?: string;
    publishedId?: string;
}

export interface WorkspaceFrame {
    node: SelectedDraftNode;
    editing: EditingState;
}

export function buildNodeFromItem(item: any): SelectedDraftNode {
    const name = item.draft_data?.name || item.draft_data?.menuName || `Untitled ${item.entity_type}`;
    if (item.isPublished) {
        if (item.entity_type === 'menu') return { type: 'published_menu', id: item.id, name };
        if (item.entity_type === 'ingredient') return { type: 'published_ingredient', id: item.id, name };
        return { type: 'published_drink', id: item.id, name };
    }
    if (item.entity_type === 'menu') return { type: 'menu_draft', id: item.id, name };
    if (item.entity_type === 'ingredient') return { type: 'ingredient_draft', id: item.id, name };
    return { type: 'drink_draft', id: item.id, name };
}

export function findItemByNode(node: SelectedDraftNode, allItems: any[]): any | null {
    return allItems.find((item) => {
        if (node.type.startsWith('published_')) {
            return item.isPublished && item.id === node.id;
        }
        return !item.isPublished && item.id === node.id;
    }) ?? null;
}

export function buildEditingStateFromItem(item: any): EditingState {
    if (item.isPublished) {
        return {
            mode: 'edit',
            type: item.entity_type,
            publishedId: item.id.replace('beer-', '').replace('wine-', ''),
        };
    }
    return {
        mode: 'create',
        type: item.entity_type,
        draftId: item.id,
        barId: item.bar_id,
    };
}

export function buildWorkspaceFrame(node: SelectedDraftNode, allItems: any[]): WorkspaceFrame | null {
    const item = findItemByNode(node, allItems);
    if (!item) return null;
    return {
        node,
        editing: buildEditingStateFromItem(item),
    };
}

export function isNavigableIngredient(
    ingredientId: string,
    drafts: any[],
    publishedIngredients: any[] | undefined
): boolean {
    if (drafts.some((d) => d.id === ingredientId && d.entity_type === 'ingredient')) {
        return true;
    }
    return !!publishedIngredients?.some((i) => i.id === ingredientId);
}

export function buildNodeFromIngredientId(
    ingredientId: string,
    drafts: any[],
    publishedIngredients: any[] | undefined
): SelectedDraftNode | null {
    const draft = drafts.find((d) => d.id === ingredientId && d.entity_type === 'ingredient');
    if (draft) {
        return {
            type: 'ingredient_draft',
            id: draft.id,
            name: draft.draft_data?.name || 'Untitled Ingredient',
        };
    }

    const published = publishedIngredients?.find((i) => i.id === ingredientId);
    if (published) {
        return {
            type: 'published_ingredient',
            id: published.id,
            name: published.name,
        };
    }

    return null;
}
