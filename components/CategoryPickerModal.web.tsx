import { CategoryTree } from "@/components/CategoryTree";
import { MenuSheet } from "@/components/screens/menus/MenuSheet";
import React, { forwardRef, useImperativeHandle, useState } from "react";
import { useDropdowns } from "@/hooks/useDropdowns";
import { DatabaseCategory } from "@/types/types";

interface CategoryPickerModalProps {
    domains: ('beer' | 'wine' | 'spirit')[];
    selectedCategoryIds: string[];
    onToggleCategory: (category: DatabaseCategory) => void;
}

/**
 * The web's category picker: the app's sheet, which is a dialog in the middle
 * of the window here, opened through the same present/dismiss ref as the
 * native bottom sheet.
 */
export const CategoryPickerModal = forwardRef<{ present: () => void; dismiss: () => void }, CategoryPickerModalProps>(
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
                        const cat = allCategories.find((c) => c.id === id);
                        if (cat) onToggleCategory(cat);
                    }}
                />
            </MenuSheet>
        );
    }
);

CategoryPickerModal.displayName = 'CategoryPickerModal';
