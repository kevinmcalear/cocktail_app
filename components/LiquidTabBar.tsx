import { palette } from "@/constants/palette";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useIsWideWeb } from "@/hooks/useIsWideWeb";
import { useSettingsStore } from "@/store/useSettingsStore";
import { BottomTabBarProps } from "expo-router/js-tabs";
import { PlatformPressable, useLinkBuilder } from "expo-router/react-navigation";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import type { ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, XStack } from "tamagui";
import { UniversalCreateButton } from "./UniversalCreateButton";

// iOS 26 draws real Liquid Glass; elsewhere a blur with the palette's glass tint.
const LIQUID_GLASS = isLiquidGlassAvailable();

const TAB_BAR_HEIGHT = 65;
const tabBarBottom = (safeBottom: number) => Math.max(safeBottom, 20);

/**
 * Bottom padding a tab screen's scroll content needs so its last row clears the
 * floating tab bar (0 on wide web, which uses the sidebar instead).
 */
export function useFloatingTabBarInset() {
    const insets = useSafeAreaInsets();
    const isWideWeb = useIsWideWeb();
    return isWideWeb ? 0 : tabBarBottom(insets.bottom) + TAB_BAR_HEIGHT + 24;
}

function TabBarSurface({ scheme, children }: { scheme: "light" | "dark"; children: ReactNode }) {
    if (LIQUID_GLASS) {
        return (
            <GlassView glassEffectStyle="regular" isInteractive colorScheme={scheme} style={styles.surface}>
                {children}
            </GlassView>
        );
    }
    if (Platform.OS === "android") {
        // expo-blur can't blur here without wrapping every screen in a
        // BlurTargetView, and an unblurred translucent fill reads muddy. A solid,
        // raised surface is also closer to Material's navigation bar.
        return (
            <View
                style={[
                    styles.surface,
                    styles.blurWrapper,
                    { backgroundColor: palette[scheme].surface, borderColor: palette[scheme].glassBorder, elevation: 6 },
                ]}
            >
                {children}
            </View>
        );
    }
    return (
        <View style={[styles.surface, styles.blurWrapper, { borderColor: palette[scheme].glassBorder }]}>
            <BlurView intensity={80} tint={scheme} style={{ backgroundColor: palette[scheme].glass }}>
                {children}
            </BlurView>
        </View>
    );
}

export function LiquidTabBar({
    state,
    descriptors,
    navigation,
}: BottomTabBarProps) {
    const { buildHref } = useLinkBuilder();
    const colorScheme = useColorScheme();
    const insets = useSafeAreaInsets();
    const { isTestingEnabled } = useSettingsStore();
    const activeColor = palette[colorScheme].ink;
    const inactiveColor = palette[colorScheme].tabIconInactive;

    const currentRouteKey = state.routes[state.index].key;
    const currentOptions = descriptors[currentRouteKey].options as any;
    
    if (currentOptions?.tabBarStyle?.display === "none") {
        return null;
    }

    // Filter routes dynamically
    const validRoutes = state.routes.filter(route => {
        // Explicitly hide the test tab if testing is not enabled
        if (route.name === "test" && !isTestingEnabled) {
            return false;
        }

        const { options } = descriptors[route.key];
        if ((options as any)?.tabBarStyle?.display === "none") {
            return false;
        }
        if (!options.tabBarIcon && !options.tabBarLabel && !options.title) {
            return false;
        }
        return true;
    });

    return (
        <View style={[styles.container, { bottom: tabBarBottom(insets.bottom) }]}>
            <TabBarSurface scheme={colorScheme}>
                <XStack
                    role="tablist"
                    justifyContent="center"
                    alignItems="center"
                    paddingHorizontal={14}
                    gap={4}
                    height={TAB_BAR_HEIGHT}
                >
                    {validRoutes.map((route) => {
                        const { options } = descriptors[route.key];
                        const originalIndex = state.routes.findIndex(r => r.key === route.key);
                        const isFocused = state.index === originalIndex;

                        const onPress = () => {
                            const event = navigation.emit({
                                type: "tabPress",
                                target: route.key,
                                canPreventDefault: true,
                            });

                            if (!isFocused && !event.defaultPrevented) {
                                navigation.navigate(route.name, route.params);
                            }
                        };

                        const onLongPress = () => {
                            navigation.emit({
                                type: "tabLongPress",
                                target: route.key,
                            });
                        };

                        return (
                            <PlatformPressable
                                key={route.key}
                                href={buildHref(route.name, route.params)}
                                role="tab"
                                aria-selected={isFocused}
                                aria-label={options.tabBarAccessibilityLabel ?? options.title ?? route.name}
                                testID={options.tabBarButtonTestID}
                                onPress={onPress}
                                onLongPress={onLongPress}
                                style={styles.tabItem}
                            >
                                {options.tabBarIcon && options.tabBarIcon({
                                    focused: isFocused,
                                    color: isFocused ? activeColor : inactiveColor,
                                    size: 24,
                                })}
                                <Text
                                    fontSize={10}
                                    lineHeight={12}
                                    fontWeight={isFocused ? "700" : "500"}
                                    color={isFocused ? activeColor : inactiveColor}
                                    numberOfLines={1}
                                    maxFontSizeMultiplier={1.3}
                                >
                                    {options.title ?? route.name}
                                </Text>
                            </PlatformPressable>
                        );
                    })}
                    <UniversalCreateButton />
                </XStack>
            </TabBarSurface>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 100,
    },
    surface: {
        borderRadius: 35,
        overflow: "hidden",
    },
    blurWrapper: {
        borderWidth: 1,
    },
    tabItem: {
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        height: 54,
        minWidth: 58,
        paddingHorizontal: 4,
    },
});
