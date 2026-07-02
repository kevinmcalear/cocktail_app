import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { BlurView } from "expo-blur";
import React from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";

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
    const blurTint = tint || (isDark ? "systemUltraThinMaterialDark" : "light");

    return (
        <BlurView
            intensity={intensity}
            tint={blurTint as any}
            style={[
                styles.container,
                isDark
                    ? {
                          backgroundColor: Colors.dark.glass.background,
                          borderColor: Colors.dark.glass.border,
                      }
                    : {
                          backgroundColor: "rgba(255, 255, 255, 0.72)",
                          borderColor: "rgba(0, 0, 0, 0.08)",
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
