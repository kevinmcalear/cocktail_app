import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { cocktails } from "@/data/cocktails";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1740&q=80";

export default function CocktailDetailsScreen() {
    const { id } = useLocalSearchParams();
    const cocktail = cocktails.find((c) => c.id === id);

    if (!cocktail) {
        return (
            <ThemedView style={styles.container}>
                <ThemedText>Cocktail not found.</ThemedText>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{
                headerShown: true,
                headerTransparent: true,
                headerTitle: "",
                headerTintColor: Colors.dark.tint,
                headerBackTitleVisible: false,
                headerStyle: {
                    backgroundColor: "transparent"
                }
            }} />

            <Image
                source={DEFAULT_IMAGE}
                style={styles.heroImage}
                contentFit="cover"
            />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.spacer} />
                <GlassView style={styles.contentContainer} intensity={90}>
                    <View style={styles.header}>
                        <ThemedText type="title" style={styles.title}>{cocktail.name}</ThemedText>
                        <View style={styles.badges}>
                            <GlassView style={styles.badge} intensity={30}>
                                <ThemedText style={styles.badgeText}>{cocktail.category}</ThemedText>
                            </GlassView>
                            <GlassView style={styles.badge} intensity={30}>
                                <ThemedText style={styles.badgeText}>{cocktail.difficulty}</ThemedText>
                            </GlassView>
                            <GlassView style={styles.badge} intensity={30}>
                                <ThemedText style={styles.badgeText}>{cocktail.prepTime}</ThemedText>
                            </GlassView>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <ThemedText type="subtitle" style={styles.sectionTitle}>Description</ThemedText>
                        <ThemedText style={styles.text}>{cocktail.description}</ThemedText>
                    </View>

                    <View style={styles.section}>
                        <ThemedText type="subtitle" style={styles.sectionTitle}>Ingredients</ThemedText>
                        <View style={styles.ingredientsList}>
                            {cocktail.ingredients.map((ingredient, index) => (
                                <View key={index} style={styles.ingredientRow}>
                                    <IconSymbol name="circle.fill" size={6} color={Colors.dark.tint} />
                                    <ThemedText style={styles.text}>{ingredient}</ThemedText>
                                </View>
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <ThemedText type="subtitle" style={styles.sectionTitle}>Instructions</ThemedText>
                        <ThemedText style={styles.text}>{cocktail.instructions}</ThemedText>
                    </View>
                </GlassView>
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    heroImage: {
        width: "100%",
        height: "60%",
        position: "absolute",
        top: 0,
    },
    scrollContent: {
        flexGrow: 1,
    },
    spacer: {
        height: 350, // Push content down to reveal image
    },
    contentContainer: {
        flex: 1,
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        padding: 24,
        paddingBottom: 50,
        minHeight: 500,
        gap: 24
    },
    header: {
        gap: 12,
        marginBottom: 10
    },
    title: {
        fontSize: 32,
        lineHeight: 36,
        color: Colors.dark.text
    },
    badges: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.1)"
    },
    badgeText: {
        fontSize: 12,
        fontWeight: "600",
        color: Colors.dark.text
    },
    section: {
        gap: 12
    },
    sectionTitle: {
        color: Colors.dark.tint,
        fontSize: 18
    },
    text: {
        fontSize: 16,
        lineHeight: 24,
        color: Colors.dark.text,
        opacity: 0.9
    },
    ingredientsList: {
        gap: 8
    },
    ingredientRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    }
});
