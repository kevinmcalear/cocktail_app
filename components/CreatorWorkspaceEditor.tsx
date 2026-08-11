import React from 'react';
import { EditingState } from '@/lib/creatorWorkspaceUtils';
import type { EditorChromeState } from '@/lib/editorChrome';
import AddCocktailScreen from '@/app/add-cocktail';
import EditCocktailScreen from '@/app/cocktail/[id]/edit';
import AddBeerScreen from '@/app/add-beer';
import EditBeerScreen from '@/app/beer/[id]/edit';
import AddWineScreen from '@/app/add-wine';
import EditWineScreen from '@/app/wine/[id]/edit';
import AddIngredientScreen from '@/app/add-ingredient';
import EditIngredientScreen from '@/app/ingredient/[id]/edit';
import CreateMenuWizard from '@/app/menus/create/index';
import { BarInlineEditor } from '@/components/bar/BarInlineEditor';
import type { SearchItem } from '@/components/SearchList';

interface CreatorWorkspaceEditorProps {
    editing: EditingState;
    onClose: () => void;
    onSave: () => void;
    onNestedItemPress: (ingredientId: string) => void;
    onCreateDrinkPress?: (params: {
        query: string;
        barId: string;
        type?: EditingState['type'];
        menuDraftId?: string;
        menuSectionId?: string;
    }) => void;
    onOpenDrink?: (drink: SearchItem) => void;
    onChromeState?: (state: EditorChromeState | null) => void;
}

export function CreatorWorkspaceEditor({
    editing,
    onClose,
    onSave,
    onNestedItemPress,
    onCreateDrinkPress,
    onOpenDrink,
    onChromeState,
}: CreatorWorkspaceEditorProps) {
    const nestedProps = { onNestedItemPress };

    switch (editing.type) {
        case 'cocktail':
            if (editing.mode === 'edit') {
                return (
                    <EditCocktailScreen
                        isInline
                        idProp={editing.publishedId}
                        onClose={onClose}
                        onSave={onSave}
                        onChromeState={onChromeState}
                        {...nestedProps}
                    />
                );
            }
            return (
                <AddCocktailScreen
                    isInline
                    draftIdProp={editing.draftId}
                    barIdProp={editing.barId}
                    menuDraftIdProp={editing.menuDraftId}
                    menuSectionIdProp={editing.menuSectionId}
                    initialNameProp={editing.initialName}
                    onClose={onClose}
                    onSave={onSave}
                    onChromeState={onChromeState}
                    {...nestedProps}
                />
            );
        case 'beer':
            if (editing.mode === 'edit') {
                return (
                    <EditBeerScreen
                        isInline
                        idProp={editing.publishedId}
                        onClose={onClose}
                        onSave={onSave}
                    />
                );
            }
            return (
                <AddBeerScreen
                    isInline
                    draftIdProp={editing.draftId}
                    barIdProp={editing.barId}
                    initialNameProp={editing.initialName}
                    onClose={onClose}
                    onSave={onSave}
                />
            );
        case 'wine':
            if (editing.mode === 'edit') {
                return (
                    <EditWineScreen
                        isInline
                        idProp={editing.publishedId}
                        onClose={onClose}
                        onSave={onSave}
                    />
                );
            }
            return (
                <AddWineScreen
                    isInline
                    draftIdProp={editing.draftId}
                    barIdProp={editing.barId}
                    initialNameProp={editing.initialName}
                    onClose={onClose}
                    onSave={onSave}
                />
            );
        case 'ingredient':
            if (editing.mode === 'edit') {
                return (
                    <EditIngredientScreen
                        isInline
                        idProp={editing.publishedId}
                        onClose={onClose}
                        onSave={onSave}
                        onChromeState={onChromeState}
                        {...nestedProps}
                    />
                );
            }
            return (
                <AddIngredientScreen
                    isInline
                    draftIdProp={editing.draftId}
                    barIdProp={editing.barId}
                    onClose={onClose}
                    onSave={onSave}
                    onChromeState={onChromeState}
                    {...nestedProps}
                />
            );
        case 'menu':
            return (
                <CreateMenuWizard
                    isInline
                    draftIdProp={editing.draftId}
                    menuIdProp={editing.mode === 'edit' ? editing.publishedId : undefined}
                    barIdProp={editing.barId}
                    onClose={onClose}
                    onSave={onSave}
                    onChromeState={onChromeState}
                    onCreateDrinkPress={onCreateDrinkPress}
                    onOpenDrink={onOpenDrink}
                />
            );
        case 'bar':
            return (
                <BarInlineEditor
                    barId={editing.barId || editing.publishedId!}
                    onClose={onClose}
                    onChromeState={onChromeState}
                />
            );
        default:
            return null;
    }
}
