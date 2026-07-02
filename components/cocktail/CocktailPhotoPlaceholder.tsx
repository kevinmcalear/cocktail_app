import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "tamagui";

import { CustomIcon } from "@/components/ui/CustomIcons";

interface CocktailPhotoPlaceholderProps {
    onPress?: () => void;
}

export function CocktailPhotoPlaceholder({ onPress }: CocktailPhotoPlaceholderProps) {
    const theme = useTheme();
    const iconColor = theme.color11?.get() as string;

    const content = (
        <View
            style={[
                styles.container,
                { backgroundColor: theme.backgroundStrong?.get() as string, borderColor: theme.borderColor?.get() as string },
            ]}
        >
            <CustomIcon name="Coupette" size={80} color={iconColor} />
            <Text color="$color11" fontSize={13} opacity={0.65} marginTop="$3" textAlign="center">
                Tap to add photo
            </Text>
        </View>
    );

    if (!onPress) return content;

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.pressable}>
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
