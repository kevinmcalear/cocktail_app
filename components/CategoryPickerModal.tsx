import { CategoryTree } from "@/components/CategoryTree";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import React, { forwardRef, useCallback, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "tamagui";
import { useDropdowns } from "@/hooks/useDropdowns";
import { DatabaseCategory } from "@/types/types";

interface CategoryPickerModalProps {
    domains: ('beer' | 'wine' | 'spirit')[];
    selectedCategoryIds: string[];
    onToggleCategory: (category: DatabaseCategory) => void;
}

export const CategoryPickerModal = forwardRef<BottomSheetModal, CategoryPickerModalProps>(
    ({ domains, selectedCategoryIds, onToggleCategory }, ref) => {
        const theme = useTheme();
        const insets = useSafeAreaInsets();

        const { data: dropdowns } = useDropdowns();
        const allCategories = (dropdowns?.categories || []).filter(
            (c) => c.domain && domains.includes(c.domain as any)
        );

        const renderBackdrop = useCallback(
            (props: any) => (
                <BottomSheetBackdrop
                    {...props}
                    disappearsOnIndex={-1}
                    appearsOnIndex={0}
                    opacity={0.5}
                />
            ),
            []
        );

        const snapPoints = useMemo(() => ['80%'], []);

        return (
            <BottomSheetModal
                ref={ref}
                index={0}
                snapPoints={snapPoints}
                backdropComponent={renderBackdrop}
                backgroundStyle={{
                    backgroundColor: theme.background?.get() as string,
                    borderTopLeftRadius: 48,
                    borderTopRightRadius: 48,
                    borderCurve: 'continuous' as any,
                }}
                handleIndicatorStyle={{ backgroundColor: theme.borderColor?.get() as string }}
            >
                <BottomSheetScrollView
                    contentContainerStyle={{
                        paddingTop: 24,
                        paddingHorizontal: 24,
                        paddingBottom: insets.bottom + 40,
                    }}
                >
                    <CategoryTree
                        categories={allCategories}
                        selectedIds={selectedCategoryIds}
                        onToggle={(id) => {
                            Haptics.selectionAsync();
                            const cat = allCategories.find((c) => c.id === id);
                            if (cat) onToggleCategory(cat);
                        }}
                    />
                </BottomSheetScrollView>
            </BottomSheetModal>
        );
    }
);
