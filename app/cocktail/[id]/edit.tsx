import { Redirect, useLocalSearchParams } from "expo-router";

import { CocktailInlineEditor } from "@/components/cocktail/CocktailInlineEditor";

interface EditCocktailProps {
    isInline?: boolean;
    idProp?: string;
    onClose?: () => void;
    onSave?: () => void;
    onNestedItemPress?: (ingredientId: string) => void;
    onChromeState?: (state: import("@/lib/editorChrome").EditorChromeState | null) => void;
}

export default function EditCocktailScreen({
    isInline,
    idProp,
    onClose,
    onSave,
    onNestedItemPress,
    onChromeState,
}: EditCocktailProps = {}) {
    const { id: paramId } = useLocalSearchParams();
    const id = (idProp !== undefined ? idProp : paramId) as string;

    if (isInline) {
        return (
            <CocktailInlineEditor
                id={id}
                onClose={onClose}
                onSave={onSave}
                onNestedItemPress={onNestedItemPress}
                onChromeState={onChromeState}
            />
        );
    }

    return <Redirect href={`/cocktail/${id}`} />;
}
