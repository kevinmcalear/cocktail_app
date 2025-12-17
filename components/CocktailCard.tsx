import { ThemedText } from "@/components/themed-text";
import { GlassView } from "@/components/ui/GlassView";
import { Colors } from "@/constants/theme";
import { Cocktail } from "@/data/cocktails";
import { PlatformPressable } from "@react-navigation/elements";
import { Image } from "expo-image";
import { Link } from "expo-router";
import React from "react";
import { ImageSourcePropType, StyleSheet, View } from "react-native";

// Map of image names to local assets (since we don't have real URLs yet)
// In a real app these would be URLs. For now we might need placeholders or generic images.
// Since the user didn't provide images, I'll use a placeholder or check if assets exist.
// Assuming we might need to map these strings to actual require statements or use a default.
const imageMap: Record<string, ImageSourcePropType> = {
    // Add mappings if we have assets, otherwise we might see blank images or need a random unsplash url
};

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1740&q=80";

type CocktailCardProps = {
    cocktail: Cocktail;
};

export function CocktailCard({ cocktail }: CocktailCardProps) {
    return (
        <Link href={`/cocktail/${cocktail.id}`} asChild>
            <PlatformPressable style={styles.container}>
                <Image
                    source={DEFAULT_IMAGE} // Replace with dynamic image later
                    style={styles.image}
                    contentFit="cover"
                    transition={1000}
                />
                <GlassView style={styles.details} intensity={60}>
                    <View style={styles.infoRow}>
                        <View style={{ flex: 1 }}>
                            <ThemedText type="subtitle" style={styles.name}>
                                {cocktail.name}
                            </ThemedText>
                            <ThemedText style={styles.description} numberOfLines={2}>
                                {cocktail.description}
                            </ThemedText>
                        </View>
                        <View style={styles.meta}>
                            <ThemedText style={styles.price}>$22</ThemedText>
                        </View>
                    </View>
                </GlassView>
            </PlatformPressable>
        </Link>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 300,
        width: "100%",
        borderRadius: 30,
        overflow: "hidden",
        marginBottom: 20,
        backgroundColor: Colors.dark.surface,
    },
    image: {
        width: "100%",
        height: "100%",
        position: "absolute",
    },
    details: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        margin: 8,
        borderRadius: 24,
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    name: {
        color: Colors.dark.text,
        fontSize: 20,
        fontWeight: "600",
        marginBottom: 4,
    },
    description: {
        color: Colors.dark.icon, // Lighter text
        fontSize: 14,
    },
    meta: {
        justifyContent: "center",
        alignItems: "flex-end",
        paddingLeft: 10
    },
    price: {
        fontSize: 18,
        fontWeight: "bold",
        color: Colors.dark.tint
    }
});
