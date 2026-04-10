import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import React, { forwardRef, useCallback, useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Button, Text, useTheme, XStack, YStack } from "tamagui";
import { SearchBar } from "@/components/SearchBar";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useDropdowns } from "@/hooks/useDropdowns";
import { DatabaseCategory } from "@/types/types";

interface CategoryPickerModalProps {
    domain: 'beer' | 'wine' | 'spirit';
    selectedCategoryIds: string[];
    onToggleCategory: (category: DatabaseCategory) => void;
}

export const CategoryPickerModal = forwardRef<BottomSheetModal, CategoryPickerModalProps>(
    ({ domain, selectedCategoryIds, onToggleCategory }, ref) => {
        const theme = useTheme();
        const insets = useSafeAreaInsets();
        const [searchQuery, setSearchQuery] = useState("");

        const { data: dropdowns } = useDropdowns();
        const allCategories = (dropdowns?.categories || []).filter(c => c.domain === domain);

        // Group by parent
        const parents = allCategories.filter(c => !c.parent_id);
        const children = allCategories.filter(c => c.parent_id);

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

        const renderCategoryList = () => {
            return parents.map(parent => {
                const myChildren = children.filter(c => c.parent_id === parent.id);
                
                // Filter by search
                const filteredChildren = myChildren.filter(c => 
                    c.name.toLowerCase().includes(searchQuery.toLowerCase())
                );

                if (filteredChildren.length === 0) return null;

                return (
                    <YStack key={parent.id} gap="$2" marginBottom="$5">
                        <Text fontSize={14} color="$color11" textTransform="uppercase" letterSpacing={1} fontWeight="600" marginBottom="$2">
                            {parent.name}
                        </Text>
                        <XStack flexWrap="wrap" gap="$2">
                            {filteredChildren.map(child => {
                                const isSelected = selectedCategoryIds.includes(child.id);
                                return (
                                    <Button
                                        key={child.id}
                                        onPress={() => {
                                            Haptics.selectionAsync();
                                            onToggleCategory(child);
                                        }}
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
                <View style={[styles.modalHeader, { paddingHorizontal: 24, paddingVertical: 16 }]}>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.color?.get() as string }}>
                        Select Tags
                    </Text>
                    <TouchableOpacity onPress={() => (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss()}>
                        <IconSymbol name="xmark" size={24} color={theme.color11?.get() as string} />
                    </TouchableOpacity>
                </View>

                <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
                    <SearchBar
                        placeholder="Search tags..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 40 }}>
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
