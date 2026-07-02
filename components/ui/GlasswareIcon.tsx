import { CustomIcon } from "@/components/ui/CustomIcons";
import { Image } from "expo-image";
import React from "react";
import { StyleSheet } from "react-native";

interface GlasswareIconProps {
    name: string;
    iconKey?: string | null;
    iconUrl?: string | null;
    size?: number;
    color?: string;
}

export function GlasswareIcon({ name, iconKey, iconUrl, size = 24, color = "#000" }: GlasswareIconProps) {
    if (iconUrl) {
        return (
            <Image
                source={{ uri: iconUrl }}
                style={[styles.image, { width: size, height: size }]}
                contentFit="contain"
                tintColor={color}
            />
        );
    }
    return <CustomIcon name={iconKey || name} size={size} color={color} />;
}

const styles = StyleSheet.create({
    image: {
        opacity: 0.95,
    },
});
