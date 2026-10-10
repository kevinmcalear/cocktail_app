import { CategoryTree } from "@/components/CategoryTree";
import { MenuSheet } from "@/components/screens/menus/MenuSheet";
import * as Haptics from "expo-haptics";
import React, { forwardRef, useImperativeHandle, useState } from "react";
import { Platform } from "react-native";
import { useDropdowns } from "@/hooks/useDropdowns";
import { DatabaseCategory } from "@/types/types";

interface CategoryPickerModalProps {
    domains: ('beer' | 'wine' | 'spirit')[];
    selectedCategoryIds: string[];
    onToggleCategory: (category: DatabaseCategory) => void;
}

/** Opens and closes the picker from the field that shows the chosen categories. */
export interface CategoryPickerHandle {
    present: () => void;
    dismiss: () => void;
}

/**
 * The category picker: the app's sheet (springs up on phones, a dialog in the
 * middle of the window on the web), opened through a present/dismiss ref.
 */
export const CategoryPickerModal = forwardRef<CategoryPickerHandle, CategoryPickerModalProps>(
    ({ domains, selectedCategoryIds, onToggleCategory }, ref) => {
        const [open, setOpen] = useState(false);
        useImperativeHandle(ref, () => ({ present: () => setOpen(true), dismiss: () => setOpen(false) }), []);

        const { data: dropdowns } = useDropdowns();
        const allCategories = (dropdowns?.categories || []).filter(
            (c) => c.domain && (domains as string[]).includes(c.domain)
        );

        return (
            <MenuSheet visible={open} onClose={() => setOpen(false)} title="Categories">
                <CategoryTree
                    categories={allCategories}
                    selectedIds={selectedCategoryIds}
                    onToggle={(id) => {
                        if (Platform.OS !== 'web') Haptics.selectionAsync();
                        const cat = allCategories.find((c) => c.id === id);
                        if (cat) onToggleCategory(cat);
                    }}
                />
            </MenuSheet>
        );
    }
);

CategoryPickerModal.displayName = 'CategoryPickerModal';
