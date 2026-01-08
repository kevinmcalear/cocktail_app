import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { DatabaseCocktail } from "@/types/types";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CocktailDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [cocktail, setCocktail] = useState<DatabaseCocktail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            fetchCocktailDetails();
        }
    }, [id]);

    const fetchCocktailDetails = async () => {
        try {
            const { data, error } = await supabase
                .from('cocktails')
                .select(`
                    *,
                    recipes (
                        id,
                        ingredient_ml,
                        ingredient_dash,
                        ingredient_amount,
                        ingredients (
                            name
                        )
                    ),
                    methods ( name ),
                    glassware ( name ),
                    families ( name )
                `)
                .eq('id', id)
                .single();

            if (error) {
                console.error('Error fetching cocktail details:', error);
            }

            if (data) {
                setCocktail(data);
            }
        } catch (error) {
            console.error('Error fetching cocktail details:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatIngredient = (recipe: any) => {
        const parts = [];
        if (recipe.ingredient_ml) parts.push(`${recipe.ingredient_ml}ml`);
        if (recipe.ingredient_dash) parts.push(`${recipe.ingredient_dash} dash${recipe.ingredient_dash > 1 ? 'es' : ''}`);
        if (recipe.ingredient_amount) parts.push(`${recipe.ingredient_amount}`);

        if (recipe.ingredients && recipe.ingredients.name) {
            parts.push(recipe.ingredients.name);
        }

        return parts.join(' ');
    };

    if (loading) {
        return (
            <ThemedView style={styles.container}>
                <ThemedText>Loading...</ThemedText>
            </ThemedView>
        );
    }

    if (!cocktail) {
        return (
            <ThemedView style={styles.container}>
                <ThemedText>Cocktail not found.</ThemedText>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <Image
                source={require('@/assets/images/cocktails/house_martini.png')}
                style={styles.heroImage}
                resizeMode="cover"
            />

            {/* Custom Back Button */}
            <TouchableOpacity
                style={[styles.backButton, { top: insets.top + 10 }]}
                onPress={() => router.back()}
            >
                <GlassView intensity={50} style={styles.backButtonGlass}>
                    <IconSymbol name="chevron.left" size={24} color={Colors.dark.text} />
                </GlassView>
            </TouchableOpacity>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.spacer} />
                <GlassView style={styles.contentContainer} intensity={90}>
                    <View style={styles.header}>
                        <ThemedText type="title" style={styles.title}>{cocktail.name}</ThemedText>

                        {/* Metadata Badges */}
                        <View style={styles.badges}>
                            {[
                                cocktail.methods?.name,
                                cocktail.glassware?.name,
                                cocktail.families?.name
                            ].filter(Boolean).map((badge, index) => (
                                <GlassView key={index} style={styles.badge} intensity={30}>
                                    <ThemedText style={styles.badgeText}>{badge}</ThemedText>
                                </GlassView>
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <ThemedText type="subtitle" style={styles.sectionTitle}>Description</ThemedText>
                        <ThemedText style={styles.text}>{cocktail.description}</ThemedText>
                    </View>

                    {cocktail.recipes && cocktail.recipes.length > 0 && (
                        <View style={styles.section}>
                            <ThemedText type="subtitle" style={styles.sectionTitle}>Ingredients</ThemedText>
                            <View style={styles.ingredientsList}>
                                {cocktail.recipes.map((recipe, index) => (
                                    <View key={index} style={styles.ingredientRow}>
                                        <IconSymbol name="circle.fill" size={6} color={Colors.dark.tint} />
                                        <ThemedText style={styles.text}>{formatIngredient(recipe)}</ThemedText>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Additional Details */}
                    <View style={styles.section}>
                        <ThemedText type="subtitle" style={styles.sectionTitle}>Details</ThemedText>
                        <View style={styles.detailsList}>
                            {/* Garnish */}
                            {cocktail.garnish && (
                                <View style={styles.detailRow}>
                                    <ThemedText style={styles.detailLabel}>Garnish:</ThemedText>
                                    <ThemedText style={styles.detailValue}>{cocktail.garnish}</ThemedText>
                                </View>
                            )}
                            {/* Origin */}
                            {cocktail.origin && (
                                <View style={styles.detailRow}>
                                    <ThemedText style={styles.detailLabel}>Origin:</ThemedText>
                                    <ThemedText style={styles.detailValue}>{cocktail.origin}</ThemedText>
                                </View>
                            )}
                            {/* Notes */}
                            {cocktail.notes && (
                                <View style={styles.detailRow}>
                                    <ThemedText style={styles.detailLabel}>Notes:</ThemedText>
                                    <ThemedText style={styles.detailValue}>{cocktail.notes}</ThemedText>
                                </View>
                            )}
                            {/* Spec */}
                            {cocktail.spec && (
                                <View style={styles.detailRow}>
                                    <ThemedText style={styles.detailLabel}>Spec:</ThemedText>
                                    <ThemedText style={styles.detailValue}>{cocktail.spec}</ThemedText>
                                </View>
                            )}
                        </View>
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
    },
    detailsList: {
        gap: 8
    },
    detailRow: {
        flexDirection: 'row',
        gap: 8,
    },
    detailLabel: {
        fontWeight: 'bold',
        color: Colors.dark.text,
        fontSize: 16,
    },
    detailValue: {
        color: Colors.dark.text,
        fontSize: 16,
        flex: 1,
        opacity: 0.9
    },
    backButton: {
        position: 'absolute',
        left: 20,
        zIndex: 10,
    },
    backButtonGlass: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
    },
});
