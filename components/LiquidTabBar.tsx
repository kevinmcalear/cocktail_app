import { GlassView } from "@/components/ui/GlassView";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import { useLinkBuilder } from "@react-navigation/native";
import { StyleSheet, View } from "react-native";

export function LiquidTabBar({
    state,
    descriptors,
    navigation,
}: BottomTabBarProps) {
    const { buildHref } = useLinkBuilder();
    const colorScheme = useColorScheme();
    const theme = colorScheme === "dark" ? Colors.dark : Colors.light;

    return (
        <View style={styles.container}>
            <GlassView style={styles.tabBar} intensity={80}>
                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key];
                    const label =
                        options.tabBarLabel !== undefined
                            ? options.tabBarLabel
                            : options.title !== undefined
                                ? options.title
                                : route.name;

                    const isFocused = state.index === index;

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
                            style={[styles.tabItem]}
                        >
                            {options.tabBarIcon && options.tabBarIcon({
                                focused: isFocused,
                                color: isFocused ? theme.tabIconSelected : theme.tabIconDefault,
                                size: 24
                            })}
                            {/* Optional: Hide label for cleaner look, or show it small */}
                            {/* <Text style={{ color: isFocused ? theme.tint : theme.icon }}>
                {label as string}
              </Text> */}
                        </PlatformPressable>
                    );
                })}
            </GlassView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        bottom: 30,
        left: 20,
        right: 20,
        alignItems: "center",
    },
    tabBar: {
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        height: 70,
        width: "100%",
        borderRadius: 35,
        paddingHorizontal: 10,
    },
    tabItem: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
    },
});
