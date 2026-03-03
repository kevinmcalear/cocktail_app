import { CustomIcon } from "@/components/ui/CustomIcons";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import { Button, Text, useTheme, XStack, YStack } from "tamagui";

interface FilterModalProps {
    visible: boolean;
    onClose: () => void;
    activeFilters: string[];
    onToggleFilter: (category: string) => void;
    showFavesOnly: boolean;
    onToggleFavesOnly: () => void;
}

export function FilterModal({
    visible,
    onClose,
    activeFilters,
    onToggleFilter,
    showFavesOnly,
    onToggleFavesOnly,
}: FilterModalProps) {
    const theme = useTheme();
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);

    const snapPoints = useMemo(() => ['40%'], []);

    useEffect(() => {
        if (visible) {
            bottomSheetModalRef.current?.present();
        } else {
            bottomSheetModalRef.current?.dismiss();
        }
    }, [visible]);

    const handleSheetChanges = useCallback((index: number) => {
        if (index === -1) {
            onClose();
        }
    }, [onClose]);

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

    const handleCategorySelect = (cat: string) => {
        Haptics.selectionAsync();
        onToggleFilter(cat);
    };

    const handleFavesToggle = () => {
        Haptics.selectionAsync();
        onToggleFavesOnly();
    };

    const backgroundColor = theme.background?.get() as string;
    const indicatorColor = theme.borderColor?.get() as string;

    const allCategories = ["Cocktails", "Beers", "Wines", "Ingredients"];
    const isAllSelected = allCategories.every(cat => activeFilters.includes(cat));

    const getCategoryIcon = (cat: string) => {
        switch (cat) {
            case "Cocktails": return "TabDrinks";
            case "Beers": return "Beer";
            case "Wines": return "Wine";
            case "Ingredients": return "TabIngredients";
            default: return null;
        }
    };

    return (
        <BottomSheetModal
            ref={bottomSheetModalRef}
            index={0}
            snapPoints={snapPoints}
            onChange={handleSheetChanges}
            backdropComponent={renderBackdrop}
            backgroundStyle={{ 
                backgroundColor: backgroundColor,
                borderTopLeftRadius: 48,
                borderTopRightRadius: 48,
                borderCurve: 'continuous' as any 
            }}
            handleIndicatorStyle={{ backgroundColor: indicatorColor }}
        >
            <BottomSheetView style={styles.contentContainer}>
                
                <YStack gap="$2" marginBottom="$5">
                    <Text fontSize={14} color="$color11" textTransform="uppercase" letterSpacing={1} fontWeight="600" marginBottom="$2">
                        Category
                    </Text>
                    <XStack flexWrap="wrap" gap="$2">
                        <Button
                            onPress={() => handleCategorySelect("All")}
                            size="$3"
                            borderRadius="$6"
                            backgroundColor={isAllSelected ? "$color8" : "transparent"}
                            borderWidth={1}
                            borderColor={isAllSelected ? "$color8" : "$borderColor"}
                        >
                            <Text color={isAllSelected ? "$backgroundStrong" : "$color"} fontWeight="600">All</Text>
                        </Button>

                        {allCategories.map((cat) => {
                            const isSelected = activeFilters.includes(cat);
                            const iconName = getCategoryIcon(cat);
                            return (
                                <Button
                                    key={cat}
                                    onPress={() => handleCategorySelect(cat)}
                                    size="$3"
                                    borderRadius="$6"
                                    backgroundColor={isSelected ? "$color8" : "transparent"}
                                    borderWidth={1}
                                    borderColor={isSelected ? "$color8" : "$borderColor"}
                                    icon={iconName ? <CustomIcon name={iconName} size={16} color={isSelected ? theme.backgroundStrong?.get() as string : theme.color?.get() as string} /> : undefined}
                                >
                                    <Text color={isSelected ? "$backgroundStrong" : "$color"} fontWeight="600">{cat}</Text>
                                </Button>
                            );
                        })}
                    </XStack>
                </YStack>

                <YStack gap="$2" marginBottom="$5">
                    <Text fontSize={14} color="$color11" textTransform="uppercase" letterSpacing={1} fontWeight="600" marginBottom="$2">
                        Show
                    </Text>
                    <XStack flexWrap="wrap" gap="$2">
                        <Button
                            onPress={handleFavesToggle}
                            size="$3"
                            borderRadius="$6"
                            backgroundColor={showFavesOnly ? "#FF4B4B" : "transparent"}
                            borderWidth={1}
                            borderColor={showFavesOnly ? "#FF4B4B" : "$borderColor"}
                            icon={<IconSymbol name="heart.fill" size={16} color={showFavesOnly ? theme.backgroundStrong?.get() as string : theme.color?.get() as string} />}
                        >
                            <Text color={showFavesOnly ? "$backgroundStrong" : "$color"} fontWeight="600">Favourites</Text>
                        </Button>
                    </XStack>
                </YStack>
                
            </BottomSheetView>
        </BottomSheetModal>
    );
}

const styles = StyleSheet.create({
    contentContainer: {
        flex: 1,
        padding: 24,
    },
});
