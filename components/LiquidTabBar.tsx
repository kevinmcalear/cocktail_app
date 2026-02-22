import { useColorScheme } from "@/hooks/use-color-scheme";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import { useLinkBuilder } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

export function LiquidTabBar({
    state,
    descriptors,
    navigation,
}: BottomTabBarProps) {
    const { buildHref } = useLinkBuilder();
    const colorScheme = useColorScheme();
    
    // Minimalist dark theme for the tab bar icons
    const activeColor = "#FFFFFF";
    const inactiveColor = "rgba(255, 255, 255, 0.4)";

    // Check if the current tab should be hidden
    const currentRouteKey = state.routes[state.index].key;
    const currentOptions = descriptors[currentRouteKey].options as any;
    
    if (currentOptions?.tabBarStyle?.display === "none") {
        return null;
    }

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['transparent', '#000000']}
                locations={[0, 1]}
                style={styles.gradientFade}
            />
            <View style={styles.solidBackground}>
                <View style={styles.tabBar}>
                    {(() => {
                        const mainTabs = ["index", "drinks", "menus", "prep", "test", "profile"];
                        
                        console.log("Current state routes: ", state.routes.map(r => r.name));
                        // Filter the active router states down to just the ones we explicitly want in the tab bar
                        const validRoutes = state.routes.filter(r => {
                            if (mainTabs.includes(r.name)) return true;
                            // Sometimes nested index paths get named with /index or similar
                            if (r.name.startsWith("menus/") || r.name === "menus/index") return true;
                            if (r.name.startsWith("test/") || r.name === "test/index") return true;
                            return false;
                        });

                        console.log("Valid routes captured: ", validRoutes.map(r => r.name));
                        
                        // Use a fallback normalization for naming checks
                        const normalizeRouteName = (name: string) => {
                            if (name.includes("menus")) return "menus";
                            if (name.includes("test")) return "test";
                            return name;
                        };
                        
                        // Sort them to match the exact intended visual order of mainTabs
                        validRoutes.sort((a, b) => mainTabs.indexOf(normalizeRouteName(a.name)) - mainTabs.indexOf(normalizeRouteName(b.name)));

                        return validRoutes.map((route, routeIndex) => {
                            const { options } = descriptors[route.key];
                            
                            // The true state.index might be different than our custom mapped index.
                            // state.index refers to the raw state.routes array.
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
                        });
                    })()}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
    gradientFade: {
        width: "100%",
        height: 60, // How tall the fade effect is above the solid black
    },
    solidBackground: {
        backgroundColor: '#000000',
        width: "100%",
    },
    tabBar: {
        flexDirection: "row",
        justifyContent: "space-around", // Distribute spacing evenly around items
        alignItems: "center",
        paddingBottom: 35, // Safe area / bottom spacing
        paddingHorizontal: 10, // Reduce padding to allow more spacing room
    },
    tabItem: {
        alignItems: "center",
        justifyContent: "center",
        height: 50,
        width: 44, // Fixed tap width instead of flex: 1 for perfectly even centering
    },
});
