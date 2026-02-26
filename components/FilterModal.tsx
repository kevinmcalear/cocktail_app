import { IconSymbol } from "@/components/ui/icon-symbol";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import { Button, Switch, Text, useTheme, XStack, YStack } from "tamagui";

interface FilterModalProps {
    visible: boolean;
    onClose: () => void;
    selectedCategory: "All" | "Cocktails" | "Beers" | "Wines";
    onSelectCategory: (category: "All" | "Cocktails" | "Beers" | "Wines") => void;
    showFavesOnly: boolean;
    onToggleFavesOnly: () => void;
}

export function FilterModal({
    visible,
    onClose,
    selectedCategory,
    onSelectCategory,
    showFavesOnly,
    onToggleFavesOnly,
}: FilterModalProps) {
    const theme = useTheme();
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);

    const snapPoints = useMemo(() => ['65%'], []);

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

    const handleCategorySelect = (cat: "All" | "Cocktails" | "Beers" | "Wines") => {
        Haptics.selectionAsync();
        onSelectCategory(cat);
    };

    const handleFavesToggle = () => {
        Haptics.selectionAsync();
        onToggleFavesOnly();
    };

    const backgroundColor = theme.background?.get() as string;
    const indicatorColor = theme.borderColor?.get() as string;

    return (
        <BottomSheetModal
            ref={bottomSheetModalRef}
            index={0}
            snapPoints={snapPoints}
            onChange={handleSheetChanges}
            backdropComponent={renderBackdrop}
            backgroundStyle={{ backgroundColor: backgroundColor }}
            handleIndicatorStyle={{ backgroundColor: indicatorColor }}
        >
            <BottomSheetView style={styles.contentContainer}>
                
                <XStack justifyContent="space-between" alignItems="center" marginBottom="$5">
                    <Text fontSize={20} fontWeight="bold" color="$color">Filters</Text>
                    <Button unstyled onPress={onClose} padding="$2" pressStyle={{ opacity: 0.5 }}>
                        <IconSymbol name="xmark.circle.fill" size={24} color={theme.color11?.get() as string} />
                    </Button>
                </XStack>

                <YStack gap="$2" marginBottom="$5">
                    <Text fontSize={14} color="$color11" textTransform="uppercase" letterSpacing={1} fontWeight="600" marginBottom="$2">
                        Category
                    </Text>
                    <XStack flexWrap="wrap" gap="$2">
                        {["All", "Cocktails", "Beers", "Wines"].map((cat) => {
                            const isSelected = selectedCategory === cat;
                            return (
                                <Button
                                    key={cat}
                                    onPress={() => handleCategorySelect(cat as any)}
                                    size="$3"
                                    borderRadius="$6"
                                    backgroundColor={isSelected ? "$color8" : "transparent"}
                                    borderWidth={1}
                                    borderColor={isSelected ? "$color8" : "$borderColor"}
                                >
                                    <Text color={isSelected ? "$backgroundStrong" : "$color"} fontWeight="600">{cat}</Text>
                                </Button>
                            );
                        })}
                    </XStack>
                </YStack>

                <YStack gap="$2" marginBottom="$5">
                    <XStack 
                        justifyContent="space-between" 
                        alignItems="center" 
                        padding="$3" 
                        backgroundColor="$backgroundStrong" 
                        borderRadius="$5"
                        borderWidth={1}
                        borderColor="$borderColor"
                        onPress={handleFavesToggle}
                        pressStyle={{ opacity: 0.7 }}
                    >
                        <XStack alignItems="center" gap="$2">
                            <IconSymbol name="heart.fill" size={20} color={showFavesOnly ? "#FF4B4B" : theme.color11?.get() as string} />
                            <Text fontSize={16} fontWeight="500" color="$color">
                                Only show favourites
                            </Text>
                        </XStack>
                        <Switch 
                            size="$3" 
                            checked={showFavesOnly} 
                            onCheckedChange={handleFavesToggle}
                            backgroundColor={showFavesOnly ? "$color8" : "$borderColor"}
                        >
                            <Switch.Thumb />
                        </Switch>
                    </XStack>
                </YStack>

                <Button 
                    size="$5" 
                    backgroundColor="$color8" 
                    borderRadius="$6" 
                    onPress={onClose}
                >
                    <Text color="$backgroundStrong" fontWeight="bold">Show Results</Text>
                </Button>
                
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
