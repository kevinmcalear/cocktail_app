import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import React, { forwardRef, useCallback, useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity, View, LayoutAnimation } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Button, Text, useTheme, XStack, YStack } from "tamagui";
import { useDropdowns } from "@/hooks/useDropdowns";
import { DatabaseCategory } from "@/types/types";

interface CategoryPickerModalProps {
    domains: ('beer' | 'wine' | 'spirit')[];
    selectedCategoryIds: string[];
    onToggleCategory: (category: DatabaseCategory) => void;
}

const CategoryLayer = ({ parentId, allCategories, selectedCategoryIds, handleToggle, depth = 0 }: any) => {
    const nodes = allCategories.filter((c: any) => c.parent_id === parentId);
    if (nodes.length === 0) return null;

    return (
        <YStack gap="$4">
            <XStack flexWrap="wrap" gap="$2">
                {nodes.map((child: any) => {
                    const isSelected = selectedCategoryIds.includes(child.id);
                    return (
                        <Button
                            key={child.id}
                            onPress={() => handleToggle(child)}
                            size="$3"
                            borderRadius="$6"
                            backgroundColor={isSelected ? "$color8" : "transparent"}
                            borderWidth={1}
                            borderColor={isSelected ? "$color8" : "$borderColor"}
                        >
                            <Text color={isSelected ? "$backgroundStrong" : "$color"} fontWeight="600">
                                {child.name}
                            </Text>
                        </Button>
                    );
                })}
            </XStack>

            {nodes.map((node: any) => {
                const subCategories = allCategories.filter((c: any) => c.parent_id === node.id);
                if (subCategories.length === 0) return null;

                const isMainSelected = selectedCategoryIds.includes(node.id);
                
                const checkHasSelectedDescendant = (id: string): boolean => {
                    const children = allCategories.filter((c: any) => c.parent_id === id);
                    if (children.some((c: any) => selectedCategoryIds.includes(c.id))) return true;
                    return children.some((c: any) => checkHasSelectedDescendant(c.id));
                };
                
                const hasSelectedChild = checkHasSelectedDescendant(node.id);
                const expanded = isMainSelected || hasSelectedChild;

                if (!expanded) return null;

                return (
                    <YStack key={`sub-${node.id}`} paddingLeft="$3" borderLeftWidth={2} borderColor="$color8" marginLeft="$2" marginTop="$2">
                        <Text fontSize={12} color="$color11" textTransform="uppercase" letterSpacing={1} fontWeight="600" marginBottom="$2">
                            {node.name} Specifics
                        </Text>
                        <CategoryLayer 
                            parentId={node.id} 
                            allCategories={allCategories} 
                            selectedCategoryIds={selectedCategoryIds}
                            handleToggle={handleToggle}
                            depth={depth + 1}
                        />
                    </YStack>
                );
            })}
        </YStack>
    );
};

export const CategoryPickerModal = forwardRef<BottomSheetModal, CategoryPickerModalProps>(
    ({ domains, selectedCategoryIds, onToggleCategory }, ref) => {
        const theme = useTheme();
        const insets = useSafeAreaInsets();

        const { data: dropdowns } = useDropdowns();
        const allCategories = (dropdowns?.categories || []).filter(c => c.domain && domains.includes(c.domain as any));

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

        const handleToggle = (child: DatabaseCategory) => {
            Haptics.selectionAsync();
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            onToggleCategory(child);
        };

        const renderCategoryList = () => {
            const roots = allCategories.filter(c => !c.parent_id);

            return roots.map(root => {
                const mainPills = allCategories.filter(c => c.parent_id === root.id);
                if (mainPills.length === 0) return null;

                return (
                    <YStack key={root.id} marginBottom="$6">
                        <Text fontSize={14} color="$color11" textTransform="uppercase" letterSpacing={1} fontWeight="600" marginBottom="$3">
                            {root.name}
                        </Text>
                        <CategoryLayer 
                            parentId={root.id} 
                            allCategories={allCategories} 
                            selectedCategoryIds={selectedCategoryIds}
                            handleToggle={handleToggle}
                        />
                    </YStack>
                );
            });
        };

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
                    borderCurve: 'continuous' as any 
                }}
                handleIndicatorStyle={{ backgroundColor: theme.borderColor?.get() as string }}
            >
                <BottomSheetScrollView contentContainerStyle={{ paddingTop: 24, paddingHorizontal: 24, paddingBottom: insets.bottom + 40 }}>
                    {renderCategoryList()}
                </BottomSheetScrollView>
            </BottomSheetModal>
        );
    }
);

const styles = StyleSheet.create({
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    }
});
