import { BottomSearchBar } from "@/components/BottomSearchBar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { Colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { DatabaseCocktail } from "@/types/types";
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, FlatList, Image, Keyboard, Platform, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CocktailsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState("");
    const [cocktails, setCocktails] = useState<DatabaseCocktail[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCocktails();
    }, []);

    const fetchCocktails = async () => {
        console.log("Fetching cocktails from Supabase...");
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
                `);

            if (error) {
                console.error('Error fetching cocktails:', error);
            }

            if (data) {
                console.log(`Fetched ${data.length} cocktails from Supabase.`);
                // console.log("Cocktail data:", JSON.stringify(data, null, 2));
                setCocktails(data);
            } else {
                console.log("No data returned from Supabase.");
            }
        } catch (error) {
            console.error('Error fetching cocktails:', error);
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

    const filteredCocktails = cocktails.filter((cocktail) =>
        cocktail.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const translateY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const showSubscription = Keyboard.addListener(
            Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
            (e) => {
                Animated.timing(translateY, {
                    toValue: -(e.endCoordinates.height - insets.bottom),
                    // User requested faster animation. Multiplying by 0.7 to make it snappy.
                    duration: (e.duration || 250) * 0.7,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.ease),
                }).start();
            }
        );
        const hideSubscription = Keyboard.addListener(
            Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
            (e) => {
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: (e.duration || 250) * 0.7,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.ease),
                }).start();
            }
        );

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, [insets.bottom, translateY]);

    const handleCocktailPress = (cocktail: DatabaseCocktail) => {
        router.push(`/cocktail/${cocktail.id}`);
    };

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Content Layer */}
            <View style={StyleSheet.absoluteFill}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View>
                        {/* Header */}
                        <GlassView style={[styles.header, { paddingTop: insets.top + 10 }]} intensity={80}>
                            <TouchableOpacity onPress={() => router.push("/")} style={styles.headerTitleContainer}>
                                <ThemedText type="title" style={styles.title}>Caretaker's{"\n"}Cottage</ThemedText>
                            </TouchableOpacity>
                            <View style={{ flex: 1 }} />
                        </GlassView>

                        <View style={styles.subHeader}>
                            <ThemedText type="subtitle" style={styles.subtitle}>Cocktails</ThemedText>
                        </View>
                    </View>
                </TouchableWithoutFeedback>

                <FlatList
                    data={filteredCocktails}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[styles.listContent, { paddingBottom: 220 + insets.bottom }]}
                    showsVerticalScrollIndicator={false}
                    keyboardDismissMode="on-drag"
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                        <GlassView style={styles.itemCard} intensity={40}>
                            <TouchableOpacity
                                style={styles.cardContainer}
                                onPress={() => handleCocktailPress(item)}
                            >
                                <Image
                                    source={require('@/assets/images/cocktails/house_martini.png')}
                                    style={styles.cardImage}
                                    resizeMode="cover"
                                />
                                <View style={styles.cardFooter}>
                                    <ThemedText type="subtitle" style={styles.cardTitle}>{item.name}</ThemedText>
                                </View>
                            </TouchableOpacity>
                        </GlassView>
                    )}
                />
            </View>

            {/* Controls Layer - Animated */}
            <Animated.View
                style={[
                    styles.controlsLayer,
                    {
                        paddingBottom: insets.bottom + 10,
                        transform: [{ translateY }]
                    }
                ]}
                pointerEvents="box-none"
            >


                {/* Search Bar */}
                <BottomSearchBar
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={styles.searchBar}
                    placeholder="Find your cocktail..."
                />
            </Animated.View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingBottom: 20,
        zIndex: 10,
    },
    headerTitleContainer: {
        // acts as a button to go home
    },
    title: {
        fontSize: 24,
        lineHeight: 28,
    },
    subHeader: {
        paddingHorizontal: 20,
        paddingBottom: 10,
    },
    subtitle: {
        fontSize: 32,
        fontWeight: "bold",
    },
    listContent: {
        paddingHorizontal: 20,
        gap: 15,
        paddingTop: 10,
    },
    controlsLayer: {
        position: 'absolute', // Use absolute to easier stick to bottom and animate
        bottom: 0,
        left: 0,
        right: 0,
        justifyContent: "flex-end",
        paddingHorizontal: 20,
        gap: 15,
    },

    itemCard: {
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 8,
    },
    cardContainer: {
        // Container behavior
    },
    cardImage: {
        width: '100%',
        height: 250,
    },
    cardFooter: {
        padding: 16,
    },
    cardTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    searchBar: {
        // search bar styles managed by component + container padding
    },
});
