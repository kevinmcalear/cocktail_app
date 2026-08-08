import { useState } from "react";
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "tamagui";

import { CustomIcon } from "@/components/ui/CustomIcons";
import { webImageDropProps } from "@/lib/imageDrop";

interface CocktailPhotoPlaceholderProps {
    onPress?: () => void;
    onDropImages?: (uris: string[]) => void;
}

export function CocktailPhotoPlaceholder({ onPress, onDropImages }: CocktailPhotoPlaceholderProps) {
    const theme = useTheme();
    const iconColor = theme.color11?.get() as string;
    const [dragOver, setDragOver] = useState(false);
    const isWeb = Platform.OS === "web";
    const dropProps = isWeb ? (webImageDropProps(onDropImages, setDragOver) as any) : undefined;

    const content = (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: theme.backgroundStrong?.get() as string,
                    borderColor: dragOver
                        ? (theme.color8?.get() as string)
                        : (theme.borderColor?.get() as string),
                    opacity: dragOver ? 0.95 : 1,
                },
            ]}
        >
            <CustomIcon name="Coupette" size={80} color={iconColor} />
            <Text color="$color11" fontSize={13} opacity={0.65} marginTop="$3" textAlign="center">
                {dragOver ? "Drop to add photo" : isWeb ? "Drop or tap to add photo" : "Tap to add photo"}
            </Text>
        </View>
    );

    if (!onPress) {
        return (
            <View style={styles.pressable} {...dropProps}>
                {content}
            </View>
        );
    }

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.pressable} {...dropProps}>
            {content}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    pressable: {
        flex: 1,
        width: "100%",
        height: "100%",
    },
    container: {
        flex: 1,
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderStyle: "dashed",
        borderRadius: 24,
    },
});
