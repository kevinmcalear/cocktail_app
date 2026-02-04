import { Colors } from "@/constants/theme";
import { BlurView } from "expo-blur";
import React from "react";
import { StyleProp, StyleSheet, useColorScheme, ViewStyle } from "react-native";

interface GlassViewProps {
    style?: StyleProp<ViewStyle>;
    children: React.ReactNode;
    intensity?: number;
    tint?: "light" | "dark" | "default" | "systemUltraThinMaterialDark" | "systemThinMaterialDark" | "systemMaterialDark" | "systemThickMaterialDark" | "systemChromeMaterialDark";
}

export function GlassView({
    style,
    children,
    intensity = 80,
    tint,
}: GlassViewProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";
    const glassTheme = Colors.dark.glass; // Use dark glass theme primarily for this app style

    // Default to dark tint if in dark mode or if the specific design calls for it
    const blurTint = tint || (isDark ? "systemUltraThinMaterialDark" : "light");

    return (
        <BlurView
            intensity={intensity}
            tint={blurTint as any}
            style={[
                styles.container,
                isDark && {
                    // Use theme background (now translucent system gray)
                    backgroundColor: glassTheme.background,
                    borderColor: glassTheme.border,
                },
                style,
            ]}
        >
            {children}
        </BlurView>
    );
}

const styles = StyleSheet.create({
    container: {
        overflow: "hidden",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.2)",
    },
});
