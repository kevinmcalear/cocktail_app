import { CustomIcon } from '@/components/ui/CustomIcons';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PERSONAL_CONTEXT } from '@/lib/barContextFilter';
import { useAppStore } from '@/store/useAppStore';
import { creatorCreateHref } from '@/store/useCreatorNavStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, Platform, Modal, TouchableWithoutFeedback, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text, XStack, YStack, useTheme } from 'tamagui';

type UniversalCreateButtonProps = {
    variant?: 'tab' | 'button';
    width?: any;
};

export function UniversalCreateButton({ variant = 'tab', width }: UniversalCreateButtonProps) {
    const { isEditModeEnabled } = useSettingsStore();
    const selectedBarId = useAppStore((s) => s.selectedBarId);
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const theme = useTheme();
    const colorScheme = useColorScheme();
    const { height: windowHeight, width: windowWidth } = useWindowDimensions();

    const sheetRef = useRef<BottomSheetModal>(null);
    const buttonRef = useRef<any>(null);
    const snapPoints = useMemo(() => ['40%'], []);
    const [isOpen, setIsOpen] = useState(false);
    
    // Web popover states
    const [showWebPopover, setShowWebPopover] = useState(false);
    const [popoverAnchor, setPopoverAnchor] = useState<{ x: number; y: number; width: number; height: number; align: 'top' | 'bottom' } | null>(null);

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

    if (variant === 'tab' && !isEditModeEnabled) {
        return null;
    }

    const menuBarId =
        selectedBarId && selectedBarId !== PERSONAL_CONTEXT ? selectedBarId : PERSONAL_CONTEXT;
    const options = [
        { label: 'Cocktail', icon: 'TabDrinks', route: '/add-cocktail' },
        { label: 'Ingredient', icon: 'TabIngredients', route: '/add-ingredient' },
        { label: 'Beer', icon: 'Beer', route: '/add-beer' }, 
        { label: 'Wine', icon: 'Wine', route: '/add-wine' }, 
        // ponytail: menus edit in Creator Hub, not the standalone /menus/create shell
        { label: 'Menu', icon: 'TabMenus', route: creatorCreateHref('menu', menuBarId) },
    ];

    const openSheet = () => {
        if (Platform.OS === 'web') {
            buttonRef.current?.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
                const popoverHeight = 250;
                const fitsBelow = pageY + height + popoverHeight + 16 < windowHeight;
                setPopoverAnchor({
                    x: pageX,
                    y: pageY,
                    width,
                    height,
                    align: fitsBelow ? 'bottom' : 'top'
                });
                setShowWebPopover(true);
            });
        } else {
            setIsOpen(true);
            sheetRef.current?.present();
        }
    };

    const closeSheet = () => {
        setIsOpen(false);
        sheetRef.current?.dismiss();
    };

    const handleOptionPress = (route: string) => {
        closeSheet();
        router.push(route as any);
    };

    const isDark = colorScheme === 'dark';
    const popupBgColor = isDark ? 'rgba(35, 35, 38, 0.85)' : 'rgba(255, 255, 255, 0.9)';
    const popupBorderColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';

    return (
        <>
            {variant === 'button' ? (
                <Button
                    ref={buttonRef}
                    backgroundColor="$backgroundStrong"
                    pressStyle={{ opacity: 0.8 }}
                    hoverStyle={{ backgroundColor: '$borderColor' }}
                    justifyContent="center"
                    alignItems="center"
                    borderWidth={1}
                    borderColor="$borderColor"
                    borderRadius="$4"
                    paddingHorizontal="$4"
                    height={50}
                    onPress={openSheet}
                    alignSelf={width ? undefined : "flex-start"}
                    width={width ?? 200}
                    icon={<IconSymbol name="plus" size={18} color={theme.color?.get() as string} />}
                >
                    <Text color="$color" fontSize={15} fontWeight="600">Create New</Text>
                </Button>
            ) : (
                <TouchableOpacity
                    ref={buttonRef}
                    style={styles.tabItem}
                    activeOpacity={0.8}
                    onPress={openSheet}
                >
                    <IconSymbol name="plus.circle.fill" size={28} color="rgba(255, 255, 255, 0.4)" />
                </TouchableOpacity>
            )}

            {Platform.OS === 'web' ? (
                <Modal
                    transparent
                    visible={showWebPopover}
                    animationType="fade"
                    onRequestClose={() => setShowWebPopover(false)}
                >
                    <TouchableWithoutFeedback onPress={() => setShowWebPopover(false)}>
                        <View style={styles.webOverlay}>
                            {popoverAnchor && (
                                <View
                                    style={[
                                        styles.webPopoverContainer,
                                        {
                                            left: Math.max(16, Math.min(popoverAnchor.x + popoverAnchor.width / 2 - 100, windowWidth - 216)),
                                            borderColor: popupBorderColor,
                                        },
                                        popoverAnchor.align === 'bottom'
                                            ? { top: popoverAnchor.y + popoverAnchor.height + 8 }
                                            : { bottom: windowHeight - popoverAnchor.y + 8 }
                                    ]}
                                >
                                    <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={[styles.webBlurContainer, { backgroundColor: popupBgColor }]}>
                                        <YStack padding="$2" gap="$1">
                                            <Text fontSize={11} color="$color10" textTransform="uppercase" letterSpacing={1} fontWeight="600" paddingHorizontal="$3" paddingVertical="$2">
                                                Create New
                                            </Text>
                                            {options.map((option, index) => (
                                                <Button
                                                    key={index}
                                                    backgroundColor="transparent"
                                                    hoverStyle={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' }}
                                                    pressStyle={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)' }}
                                                    borderRadius="$3"
                                                    justifyContent="flex-start"
                                                    alignItems="center"
                                                    paddingHorizontal="$3"
                                                    height={44}
                                                    borderWidth={0}
                                                    onPress={() => {
                                                        setShowWebPopover(false);
                                                        router.push(option.route as any);
                                                    }}
                                                >
                                                    <XStack gap="$3" alignItems="center" width="100%">
                                                        <CustomIcon name={option.icon} size={20} color={theme.color?.get() as string} />
                                                        <Text color="$color" fontSize={14} fontWeight="500">{option.label}</Text>
                                                    </XStack>
                                                </Button>
                                            ))}
                                        </YStack>
                                    </BlurView>
                                </View>
                            )}
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>
            ) : (
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
            )}
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
    webOverlay: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    webPopoverContainer: {
        position: 'absolute',
        width: 200,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 5,
    },
    webBlurContainer: {
        // dynamic backgroundColor applied in style prop
    },
});
