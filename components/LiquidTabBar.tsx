import { useColorScheme } from "@/hooks/use-color-scheme";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import { useLinkBuilder } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { XStack } from "tamagui";

export function LiquidTabBar({
    state,
    descriptors,
    navigation,
}: BottomTabBarProps) {
    const { buildHref } = useLinkBuilder();
    const colorScheme = useColorScheme();
    const insets = useSafeAreaInsets();
    
    const activeColor = "#FFFFFF";
    const inactiveColor = "rgba(255, 255, 255, 0.4)";

    const currentRouteKey = state.routes[state.index].key;
    const currentOptions = descriptors[currentRouteKey].options as any;
    
    if (currentOptions?.tabBarStyle?.display === "none") {
        return null;
    }

    // Filter routes dynamically
    const validRoutes = state.routes.filter(route => {
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
        <View style={[styles.container, { bottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.blurWrapper}>
                <BlurView intensity={80} tint="dark" style={styles.blurContainer}>
                    <XStack
                        justifyContent="space-around"
                        alignItems="center"
                        paddingHorizontal={10}
                        height={65}
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
                                    accessibilityState={isFocused ? { selected: true } : {}}
                                    accessibilityLabel={options.tabBarAccessibilityLabel}
                                    testID={options.tabBarButtonTestID}
                                    onPress={onPress}
                                    onLongPress={onLongPress}
                                    style={styles.tabItem}
                                >
                                    {options.tabBarIcon && options.tabBarIcon({
                                        focused: isFocused,
                                        color: isFocused ? activeColor : inactiveColor,
                                        size: 28,
                                    })}
                                </PlatformPressable>
                            );
                        })}
                    </XStack>
                </BlurView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        left: 20,
        right: 20,
        zIndex: 100,
    },
    blurWrapper: {
        borderRadius: 35,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
    },
    blurContainer: {
        backgroundColor: "rgba(0,0,0,0.5)",
    },
    tabItem: {
        alignItems: "center",
        justifyContent: "center",
        height: 50,
        width: 44,
    },
});
