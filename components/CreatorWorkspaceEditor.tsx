import React, { lazy, Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { EditingState } from '@/lib/creatorWorkspaceUtils';
import type { EditorChromeState } from '@/lib/editorChrome';
import type { SearchItem } from '@/types/search';

// Each editor loads when it first opens. Importing the route files themselves
// (not shared components) lets the web build reuse each route's own chunk;
// static imports here put all nine editors in the chunk every page loads.
const AddCocktailScreen = lazy(() => import('@/app/add-cocktail'));
const EditCocktailScreen = lazy(() => import('@/app/cocktail/[id]/edit'));
const AddBeerScreen = lazy(() => import('@/app/add-beer'));
const EditBeerScreen = lazy(() => import('@/app/beer/[id]/edit'));
const AddWineScreen = lazy(() => import('@/app/add-wine'));
const EditWineScreen = lazy(() => import('@/app/wine/[id]/edit'));
const AddIngredientScreen = lazy(() => import('@/app/add-ingredient'));
const EditIngredientScreen = lazy(() => import('@/app/ingredient/[id]/edit'));
const CreateMenuWizard = lazy(() => import('@/app/menus/create/index'));
const BarInlineEditor = lazy(() => import('@/components/bar/BarInlineEditor').then((m) => ({ default: m.BarInlineEditor })));

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

export function CreatorWorkspaceEditor(props: CreatorWorkspaceEditorProps) {
    return (
        <Suspense
            fallback={
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator />
                </View>
            }
        >
            <Editor {...props} />
        </Suspense>
    );
}

function Editor({
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
