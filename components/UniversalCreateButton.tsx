import { CustomIcon } from '@/components/ui/CustomIcons';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useSettingsStore } from '@/store/useSettingsStore';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text, XStack, YStack, useTheme } from 'tamagui';

export function UniversalCreateButton() {
    const { isEditModeEnabled } = useSettingsStore();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const theme = useTheme();

    const sheetRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ['40%'], []);
    const [isOpen, setIsOpen] = useState(false);

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

    if (!isEditModeEnabled) {
        return null;
    }

    const options = [
        { label: 'Cocktail', icon: 'TabDrinks', route: '/add-cocktail' },
        { label: 'Ingredient', icon: 'TabIngredients', route: '/add-ingredient' },
        { label: 'Beer', icon: 'Beer', route: '/add-beer' }, 
        { label: 'Wine', icon: 'Wine', route: '/add-wine' }, 
        { label: 'Menu', icon: 'TabMenus', route: '/menus/create' },
    ];

    const openSheet = () => {
        setIsOpen(true);
        sheetRef.current?.present();
    };

    const closeSheet = () => {
        setIsOpen(false);
        sheetRef.current?.dismiss();
    };

    const handleOptionPress = (route: string) => {
        closeSheet();
        router.push(route as any);
    };

    return (
        <>
            <TouchableOpacity
                style={styles.tabItem}
                activeOpacity={0.8}
                onPress={openSheet}
            >
                <IconSymbol name="plus.circle.fill" size={28} color="rgba(255, 255, 255, 0.4)" />
            </TouchableOpacity>

            <BottomSheetModal
                ref={sheetRef}
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
                onDismiss={() => setIsOpen(false)}
            >
                <BottomSheetView style={styles.sheetContent}>
                    <YStack gap="$2" marginBottom="$5">
                        <Text fontSize={14} color="$color11" textTransform="uppercase" letterSpacing={1} fontWeight="600" marginBottom="$2">
                            Create New
                        </Text>
                        <XStack flexWrap="nowrap" justifyContent="space-between" paddingTop="$2">
                            {options.map((option, index) => (
                                <Button
                                    key={index}
                                    width={64}
                                    height={80}
                                    backgroundColor="transparent"
                                    pressStyle={{ backgroundColor: '$backgroundStrong', opacity: 0.8 }}
                                    justifyContent="center"
                                    alignItems="center"
                                    flexDirection="column"
                                    padding={0}
                                    gap="$2"
                                    borderWidth={0}
                                    onPress={() => handleOptionPress(option.route)}
                                >
                                    <CustomIcon name={option.icon} size={32} color={theme.color?.get() as string} />
                                    <Text color="$color" fontSize={12} fontWeight="500">{option.label}</Text>
                                </Button>
                            ))}
                        </XStack>
                    </YStack>
                </BottomSheetView>
            </BottomSheetModal>
        </>
    );
}

const styles = StyleSheet.create({
    tabItem: {
        alignItems: "center",
        justifyContent: "center",
        height: 50,
        width: 44,
    },
    sheetContent: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 24,
    },
});
